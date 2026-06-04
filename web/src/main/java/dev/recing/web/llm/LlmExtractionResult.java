package dev.recing.web.llm;

/** Result of a successful LLM extraction, containing the parsed recipe and metadata. */
public record LlmExtractionResult(
    RecipeExtraction extraction,
    Metadata metadata
) {
    /** Metadata about the extraction request/response cycle. */
    public record Metadata(
        String modelEndpoint,
        String model,
        long durationMs,
        String promptVersion,
        String schemaVersion,
        Integer requestContentChars,
        Boolean truncatedInput,
        Boolean parsedAsExpected,
        int httpStatusCode,
        LlmErrorCode errorCode,
        int promptTokens,
        int completionTokens
    ) {}
}
