package dev.recing.web.fetch;

public enum FetchErrorCode {
    INVALID_URL("The URL you entered is not valid. Please enter a full web address starting with http:// or https://"),
    UNSAFE_TARGET("This link appears to point to a private network address and cannot be fetched for security reasons."),
    UNREACHABLE_HOST("Could not reach the server at this address."),
    TIMEOUT("The request took too long to complete. The server may be slow or unreachable."),
    REDIRECT_FAILURE("Too many redirects or a redirect target could not be validated. The link may be broken."),
    UNSUPPORTED_CONTENT_TYPE("This page does not contain web content that can be processed."),
    RESPONSE_TOO_LARGE("The page was too large to process (over 5 MB)."),
    NON_SUCCESS_STATUS("The server returned an error response ({status}). This page may be unavailable or restricted."),
    FETCH_FAILED("An unexpected error occurred while fetching the page. Please try again.");

    private final String userMessage;

    FetchErrorCode(String userMessage) {
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
