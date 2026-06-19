package dev.recing.web.fetch;

public class RecipeFetchException extends RuntimeException {

    private final FetchErrorCode code;

    public RecipeFetchException(FetchErrorCode code, Object... args) {
        super(code.getMessage(args));
        this.code = code;
    }

    public FetchErrorCode getCode() {
        return code;
    }
}
