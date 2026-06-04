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

    /** Returns a user-safe message for display. */
    public String getUserMessage() {
        // First line of the message is the user-facing part
        String msg = getMessage();
        int parenIdx = msg.indexOf('(');
        if (parenIdx > 0) return msg.substring(0, parenIdx).trim();
        return msg;
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max);
    }
}
