package dev.recing.web.llm;

/** Controlled exception for LLM extraction failures. */
public class LlmExtractionException extends RuntimeException {

    private final LlmErrorCode code;

    public LlmExtractionException(LlmErrorCode code, Object... args) {
        super(code.getMessage(args));
        this.code = code;
    }

    public LlmExtractionException(LlmErrorCode code, String detail, Object... args) {
        super(code.getMessage(args) + " (" + truncate(detail, 200) + ")");
        this.code = code;
    }

    public LlmErrorCode getCode() {
        return code;
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max);
    }
}
