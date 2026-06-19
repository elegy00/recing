package dev.recing.web.llm;

/** Error codes for LLM extraction failures. */
public enum LlmErrorCode {
    LLM_UNAVAILABLE("The local recipe extractor is unavailable. Start llama.cpp and try again."),
    LLM_TIMEOUT("The request to the local extractor timed out. It may be busy or not running."),
    LLM_HTTP_ERROR("The local extractor returned an unexpected response (HTTP {status})."),
    LLM_BAD_RESPONSE("The extractor returned malformed data that could not be parsed."),
    LLM_SCHEMA_MISMATCH("The extractor returned data that does not match the expected recipe format."),
    LLM_CONTENT_TOO_LARGE("The page content is too large to send to the extractor."),
    LLM_FAILED("The extractor was unable to produce a valid response. Please try again.");

    private final String userMessage;

    LlmErrorCode(String userMessage) {
        this.userMessage = userMessage;
    }

    public String getUserMessage() {
        return userMessage;
    }

    /** Returns a message with placeholders replaced, or the default if no args provided. */
    public String getMessage(Object... args) {
        String msg = userMessage;
        for (Object arg : args) {
            msg = msg.replace("{status}", String.valueOf(arg));
        }
        return msg;
    }
}
