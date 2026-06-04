package dev.recing.web.llm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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

        // Step 3: Send and parse with retry loop (grill-me decision #8)
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            long attemptStart = System.currentTimeMillis();
            try {
                log.debug("LLM request attempt {} to {}", attempt, props.endpoint());
                String responseBody = client.sendChatCompletion(requestBody);
                long attemptDuration = System.currentTimeMillis() - attemptStart;
                log.info("LLM response received on attempt {} ({}ms)", attempt, attemptDuration);
                log.warn("Response body {}", responseBody);

                // Step 4: Parse response and extract content. This is inside the retry loop so
                // malformed JSON/model text like "result.json" gets exactly one retry.
                long totalDuration = System.currentTimeMillis() - totalStart;
                return parseResponse(
                    responseBody,
                    url,
                    totalDuration,
                    reduced.reducedLength(),
                    reduced.truncated()
                );
            } catch (java.net.http.HttpTimeoutException e) {
                log.warn("LLM request timed out (attempt {}/{})", attempt, MAX_ATTEMPTS);
                if (attempt < MAX_ATTEMPTS) continue;
                throw new LlmExtractionException(LlmErrorCode.LLM_TIMEOUT);
            } catch (java.io.IOException e) {
                String msg = e.getMessage();

                // Connection refused → LLM not running
                if (msg != null && (msg.contains("Connection refused") || msg.contains("connect") || msg.contains("refused"))) {
                    log.warn("LLM endpoint unreachable: {}", truncate(msg, 200));
                    throw new LlmExtractionException(LlmErrorCode.LLM_UNAVAILABLE);
                }

                // HTTP 5xx is retryable (grill-me #8); 4xx is not.
                boolean retryable = msg != null && msg.contains("HTTP 5");
                if (retryable && attempt < MAX_ATTEMPTS) {
                    log.warn("LLM HTTP 5xx on attempt {}: {}", attempt, truncate(msg, 200));
                    sleepBeforeRetry();
                    continue;
                }

                throw new LlmExtractionException(LlmErrorCode.LLM_HTTP_ERROR, msg != null ? msg : "Unknown IO error");
            } catch (LlmExtractionException e) {
                // Malformed JSON / unexpected response shape is retryable once.
                if (e.getCode() == LlmErrorCode.LLM_BAD_RESPONSE && attempt < MAX_ATTEMPTS) {
                    log.warn("Bad LLM response on attempt {}/{}; retrying: {}", attempt, MAX_ATTEMPTS, truncate(e.getMessage(), 200));
                    sleepBeforeRetry();
                    continue;
                }
                throw e;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new LlmExtractionException(LlmErrorCode.LLM_FAILED, "Request interrupted");
            }
        }

        throw new LlmExtractionException(LlmErrorCode.LLM_FAILED);
    }

    /** Parses LLM response into RecipeExtraction with metadata. */
    private LlmExtractionResult parseResponse(String responseBody, String url, long durationMs, int requestContentChars, boolean truncatedInput) {
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
            log.info("LLM assistant content: {}", content);
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
                requestContentChars,
                truncatedInput,
                true,  // parsedAsExpected
                200,   // httpStatusCode (we only get here on success)
                null,  // errorCode (only set on exception)
                promptTokens,
                completionTokens
            );

            // Debug: log the whole LLM result as-is
            String extractionJson = MAPPER.writeValueAsString(extraction);
            String metadataJson = MAPPER.writeValueAsString(metadata);
            log.info("LLM result: [{}] [{}]", extractionJson, metadataJson);
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
                throw new LlmExtractionException(LlmErrorCode.LLM_SCHEMA_MISMATCH, messages.toString());
            }
        } catch (LlmExtractionException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Schema validation failed: {}", truncate(e.getMessage(), 200));
            throw new LlmExtractionException(LlmErrorCode.LLM_SCHEMA_MISMATCH, "Schema validation failed");
        }
    }

    private static void sleepBeforeRetry() {
        try {
            Thread.sleep(RETRY_DELAY.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new LlmExtractionException(LlmErrorCode.LLM_FAILED, "Retry sleep interrupted");
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
