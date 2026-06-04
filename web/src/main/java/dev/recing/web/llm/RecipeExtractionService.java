package dev.recing.web.llm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.Set;

/**
 * Orchestrates the LLM extraction pipeline: content reduction → request building → HTTP call → parsing → validation.
 */
public class RecipeExtractionService {

    private static final Logger log = LoggerFactory.getLogger(RecipeExtractionService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    // Retry settings per grill-me decision #8
    private static final int MAX_ATTEMPTS = 2;
    private static final Duration RETRY_DELAY = Duration.ofMillis(500);

    private final RecingLlmProperties props;
    private final LlamaClient client;

    public RecipeExtractionService(RecingLlmProperties props) {
        this.props = props;
        this.client = new LlamaClient(props.endpoint(), props.timeoutSeconds());
    }

    /**
     * Extracts recipe data from fetched page content by sending it to the local LLM.
     *
     * @param url         the final URL of the fetched page
     * @param contentType the content type of the response
     * @param title       optional page title (may be null)
     * @param body        raw HTML/text body from MVP1 fetch
     * @return structured extraction result with metadata
     * @throws LlmExtractionException on controlled errors (unavailable, timeout, bad response, etc.)
     */
    public LlmExtractionResult extract(String url, String contentType, String title, String body) {
        long totalStart = System.currentTimeMillis();

        // Step 1: Reduce content
        RecipeContentReducer.ReducedContent reduced = RecipeContentReducer.reduce(body, props.maxContentChars());
        log.info("Content reduction: {} chars → {} chars (truncated={})", reduced.originalLength(), reduced.reducedLength(), reduced.truncated());

        if (reduced.text().isBlank()) {
            throw new LlmExtractionException(LlmErrorCode.LLM_CONTENT_TOO_LARGE, "No extractable content found after stripping noise");
        }

        // Step 2: Build request
        String systemPrompt = RecipeExtractionPrompt.systemPrompt(RecipeExtractionPrompt.SCHEMA_VERSION);
        String userPrompt = RecipeExtractionPrompt.userPrompt(url, contentType, reduced.truncated(), title, reduced.text());

        JsonNode schemaJson = loadSchema();
        JsonNode requestBody = LlamaClient.buildRequest(props.model(), systemPrompt, userPrompt, schemaJson);

        // Step 3: Send with retry loop (grill-me decision #8)
        String responseBody = null;
        int httpStatus = 0;
        boolean success = false;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            long attemptStart = System.currentTimeMillis();
            try {
                log.debug("LLM request attempt {} to {}", attempt, props.endpoint());
                responseBody = client.sendChatCompletion(requestBody);
                httpStatus = 200;
                success = true;
                long attemptDuration = System.currentTimeMillis() - attemptStart;
                log.info("LLM response received on attempt {} ({}ms)", attempt, attemptDuration);
            } catch (java.net.http.HttpTimeoutException e) {
                log.warn("LLM request timed out (attempt {}/{})", attempt, MAX_ATTEMPTS);
                if (attempt < MAX_ATTEMPTS) continue;
                throw new LlmExtractionException(LlmErrorCode.LLM_TIMEOUT);
            } catch (java.io.IOException e) {
                String msg = e.getMessage();
                boolean retryable = false;

                // Connection refused → LLM not running
                if (msg != null && (msg.contains("Connection refused") || msg.contains("connect") || msg.contains("refused"))) {
                    log.warn("LLM endpoint unreachable: {}", truncate(msg, 200));
                    throw new LlmExtractionException(LlmErrorCode.LLM_UNAVAILABLE);
                }

                // HTTP 5xx is retryable (grill-me #8)
                if (msg != null && msg.contains("HTTP 5")) {
                    log.warn("LLM HTTP 5xx on attempt {}: {}", attempt, truncate(msg, 200));
                    retryable = true;
                }

                // Malformed JSON response is retryable
                if (msg != null && msg.contains("Bad response") || (responseBody != null && !isValidJsonResponse(responseBody))) {
                    log.warn("Malformed LLM response on attempt {}: {}", attempt, truncate(msg != null ? msg : responseBody, 200));
                    retryable = true;
                }

                if (retryable && attempt < MAX_ATTEMPTS) {
                    try { Thread.sleep(RETRY_DELAY.toMillis()); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
                    continue;
                }

                throw new LlmExtractionException(LlmErrorCode.LLM_HTTP_ERROR, msg != null ? msg : "Unknown IO error");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new LlmExtractionException(LlmErrorCode.LLM_FAILED, "Request interrupted");
            }
        }

        if (!success || responseBody == null) {
            throw new LlmExtractionException(LlmErrorCode.LLM_FAILED);
        }

        // Step 4: Parse response and extract content
        long totalDuration = System.currentTimeMillis() - totalStart;
        return parseResponse(responseBody, url, totalDuration);
    }

    /** Validates that the response body is a well-formed OpenAI-compatible chat completion. */
    private boolean isValidJsonResponse(String body) {
        try {
            JsonNode root = MAPPER.readTree(body);
            return root.has("choices") && !root.get("choices").isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    /** Parses LLM response into RecipeExtraction with metadata. */
    private LlmExtractionResult parseResponse(String responseBody, String url, long durationMs) {
        try {
            JsonNode root = MAPPER.readTree(responseBody);

            // Extract token usage if present
            int promptTokens = 0;
            int completionTokens = 0;
            if (root.has("usage")) {
                JsonNode usage = root.get("usage");
                if (usage.has("prompt_tokens")) promptTokens = usage.get("prompt_tokens").asInt(0);
                if (usage.has("completion_tokens")) completionTokens = usage.get("completion_tokens").asInt(0);
            }

            // Get assistant content from choices[0].message.content
            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) {
                throw new LlmExtractionException(LlmErrorCode.LLM_BAD_RESPONSE, "No choices in response");
            }

            String content = choices.get(0).path("message").path("content").asText(null);
            if (content == null || content.isBlank()) {
                throw new LlmExtractionException(LlmErrorCode.LLM_FAILED, "Empty assistant content from model");
            }

            // Trim potential markdown code fences
            content = stripCodeFences(content.trim());

            // Parse as RecipeExtraction JSON
            JsonNode extractionNode = MAPPER.readTree(content);

            // Validate against schema if available
            validateAgainstSchema(extractionNode);

            // Deserialize into record
            RecipeExtraction extraction = MAPPER.treeToValue(extractionNode, RecipeExtraction.class);
            if (extraction == null) {
                throw new LlmExtractionException(LlmErrorCode.LLM_SCHEMA_MISMATCH, "Null extraction after parsing");
            }

            // Build metadata
            var metadata = new LlmExtractionResult.Metadata(
                props.endpoint(),
                props.model(),
                durationMs,
                RecipeExtractionPrompt.PROMPT_VERSION,
                RecipeExtractionPrompt.SCHEMA_VERSION,
                null, // requestContentChars — tracked separately if needed
                false, // truncatedInput — tracked from reducer result
                true,  // parsedAsExpected
                200,   // httpStatusCode (we only get here on success)
                null,  // errorCode (only set on exception)
                promptTokens,
                completionTokens
            );

            return new LlmExtractionResult(extraction, metadata);

        } catch (LlmExtractionException e) {
            throw e; // Pass through controlled exceptions
        } catch (JsonProcessingException e) {
            log.error("Failed to parse LLM response: {}", truncate(e.getMessage(), 200));
            throw new LlmExtractionException(LlmErrorCode.LLM_BAD_RESPONSE, "Could not parse model output as JSON");
        } catch (Exception e) {
            log.error("Unexpected error parsing LLM response: {}", truncate(e.getMessage(), 200));
            throw new LlmExtractionException(LlmErrorCode.LLM_FAILED, "Unexpected parse error");
        }
    }

    /** Loads the recipe-extraction JSON schema from classpath resources. */
    private JsonNode loadSchema() {
        try (InputStream schemaStream = getClass().getResourceAsStream("/mvp-2-llm-extraction-structures/recipe-extraction.schema.json")) {
            if (schemaStream == null) {
                log.warn("Schema file not found on classpath, using minimal request without response_format");
                return MAPPER.createObjectNode(); // Will cause buildRequest to need adjustment
            }
            return MAPPER.readTree(schemaStream);
        } catch (Exception e) {
            log.error("Failed to load schema: {}", truncate(e.getMessage(), 200));
            throw new LlmExtractionException(LlmErrorCode.LLM_FAILED, "Could not load extraction schema");
        }
    }

    private void validateAgainstSchema(JsonNode extractionNode) {
        try (InputStream schemaStream = getClass().getResourceAsStream("/mvp-2-llm-extraction-structures/recipe-extraction.schema.json")) {
            if (schemaStream == null) {
                log.warn("Schema file not found on classpath, skipping validation");
                return;
            }

            JsonNode schemaNode = MAPPER.readTree(schemaStream);
            JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
            JsonSchema schema = factory.getSchema(schemaNode);

            Set<ValidationMessage> messages = schema.validate(extractionNode);
            if (!messages.isEmpty()) {
                log.warn("Schema validation errors: {}", messages);
                // For MVP, log but don't fail — the extraction records themselves carry status/unusableReason
            }
        } catch (Exception e) {
            log.warn("Schema validation failed (non-fatal): {}", truncate(e.getMessage(), 200));
        }
    }

    private String stripCodeFences(String content) {
        // Remove markdown ```json ... ``` or ``` ... ``` wrappers
        if (content.startsWith("```")) {
            int firstNewline = content.indexOf('\n');
            if (firstNewline > 0 && content.endsWith("```")) {
                return content.substring(firstNewline + 1, content.length() - 3).trim();
            }
        }
        return content;
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max);
    }
}
