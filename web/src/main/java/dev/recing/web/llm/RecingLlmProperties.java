package dev.recing.web.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration properties for the LLM extraction layer. */
@ConfigurationProperties(prefix = "recing.llm")
public record RecingLlmProperties(
    String endpoint,
    String model,
    int timeoutSeconds,
    int maxContentChars
) {
    public RecingLlmProperties {
        if (endpoint == null || endpoint.isBlank()) endpoint = "http://localhost:8080/v1/chat/completions";
        if (model == null || model.isBlank()) model = "qwen3.6";
        if (timeoutSeconds <= 0) timeoutSeconds = 180;
        if (maxContentChars <= 0) maxContentChars = 60000;
    }
}
