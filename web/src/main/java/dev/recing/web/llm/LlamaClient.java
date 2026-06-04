package dev.recing.web.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;

/**
 * Thin wrapper around Java 17 HttpClient for llama.cpp /v1/chat/completions endpoint.
 * Builds and sends the request JSON, returns raw response body as a string.
 */
public class LlamaClient {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String endpoint;
    private final Duration timeout;

    public LlamaClient(String endpoint, int timeoutSeconds) {
        this.endpoint = endpoint;
        this.timeout = Duration.ofSeconds(timeoutSeconds);
    }

    /**
     * Sends a chat completion request and returns the raw response body string.
     *
     * @param requestBody the full JSON request body as a JsonNode tree
     * @return the response body string from llama.cpp
     * @throws java.io.IOException on network errors
     * @throws InterruptedException if the thread is interrupted
     */
    public String sendChatCompletion(JsonNode requestBody) throws java.io.IOException, InterruptedException {
        String jsonBody = MAPPER.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(java.net.URI.create(endpoint))
                .timeout(timeout)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<String> response = HttpClient.newHttpClient()
                .send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 500) {
            throw new java.io.IOException("HTTP " + response.statusCode() + ": " + response.body().substring(0, Math.min(response.body().length(), 200)));
        }

        return response.body();
    }

    /**
     * Builds the full chat completion request JSON tree.
     *
     * @param model       model name (e.g., "qwen3.6")
     * @param systemMsg   system prompt text
     * @param userMsg     user message text
     * @param schemaJson  inlined recipe extraction JSON schema as JsonNode
     * @return the request body as a JsonNode tree ready to serialize
     */
    public static JsonNode buildRequest(String model, String systemMsg, String userMsg, JsonNode schemaJson) {
        ObjectNode root = MAPPER.createObjectNode();

        // Build messages array
        var messagesArray = MAPPER.createArrayNode();
        var systemNode = MAPPER.createObjectNode();
        systemNode.put("role", "system");
        systemNode.put("content", systemMsg);
        messagesArray.add(systemNode);

        var userNode = MAPPER.createObjectNode();
        userNode.put("role", "user");
        userNode.put("content", userMsg);
        messagesArray.add(userNode);

        root.set("messages", messagesArray);
        root.put("model", model);
        root.put("temperature", 0.0);
        root.put("top_p", 1.0);
        root.put("max_tokens", 4096);
        root.put("stream", false);

        // response_format with inlined JSON schema
        var responseFormat = MAPPER.createObjectNode();
        responseFormat.put("type", "json_schema");

        var jsonSchema = MAPPER.createObjectNode();
        jsonSchema.put("name", "recipe_extraction");
        jsonSchema.put("strict", true);
        // Inline the full schema object
        jsonSchema.set("schema", schemaJson);

        responseFormat.set("json_schema", jsonSchema);
        root.set("response_format", responseFormat);

        return root;
    }
}
