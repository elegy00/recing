package dev.recing.web.fetch;

/** Immutable result of a successful fetch operation. */
public record RecipeFetchResult(
    String originalUrl,
    String finalUrl,
    int status,
    String contentType,
    String body,
    long byteCount
) {}
