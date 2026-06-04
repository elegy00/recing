package dev.recing.web.fetch;

import java.net.HttpURLConnection;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;

/**
 * Handles fetching recipe URLs with safety validation, redirect following,
 * and content type checking. Returns a RecipeFetchResult or throws RecipeFetchException.
 */
public class RecipeFetchService {

    private static final Duration TIMEOUT = Duration.ofSeconds(20);
    private static final int MAX_REDIRECTS = 5;
    private static final long MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

    private static final String USER_AGENT = "Recing/1.0 (Recipe Extractor)";

    private static final String[] ACCEPTED_CONTENT_TYPES = {
            "text/html",
            "application/xhtml+xml",
            "text/plain"
    };

    /**
     * Fetches the content at the given URL after validation and safety checks.
     */
    public RecipeFetchResult fetch(String submittedUrl) {
        // Step 1: Validate URL syntax and SSRF safety
        String trimmedOriginal = submittedUrl.trim();
        URI currentUri = UrlSafetyValidator.validate(trimmedOriginal);

        HttpClient client = buildHttpClient();

        // Manual redirect loop with hop counter
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(currentUri)
                    .timeout(TIMEOUT)
                    .header("Accept", "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5,*/*;q=0.1")
                    .header("User-Agent", USER_AGENT)
                    .GET()
                    .build();

            HttpResponse<byte[]> response;
            try {
                response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
            } catch (java.net.http.HttpTimeoutException e) {
                throw new RecipeFetchException(FetchErrorCode.TIMEOUT);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RecipeFetchException(FetchErrorCode.FETCH_FAILED, "Request interrupted");
            } catch (java.io.IOException | RuntimeException e) {
                if (e.getMessage() != null && e.getMessage().contains("Connection refused")) {
                    throw new RecipeFetchException(FetchErrorCode.UNREACHABLE_HOST);
                }
                throw new RecipeFetchException(FetchErrorCode.FETCH_FAILED, e.getMessage());
            }

            int status = response.statusCode();

            if (isRedirect(status)) {
                String location = response.headers().firstValue("Location").orElse(null);
                if (location == null || location.isEmpty()) {
                    throw new RecipeFetchException(FetchErrorCode.REDIRECT_FAILURE, "No Location header");
                }

                // Resolve relative URI against current URL
                try {
                    currentUri = currentUri.resolve(location);
                } catch (IllegalArgumentException e) {
                    throw new RecipeFetchException(FetchErrorCode.REDIRECT_FAILURE, "Invalid redirect URL");
                }

                // Validate the redirect target for SSRF safety before following
                UrlSafetyValidator.validate(currentUri.toString());

            } else if (status == HttpURLConnection.HTTP_OK || status == HttpURLConnection.HTTP_NOT_MODIFIED) {
                // Success — process the body
                return processResponse(trimmedOriginal, currentUri.toString(), status, response);

            } else {
                // Non-success, non-redirect status
                throw new RecipeFetchException(FetchErrorCode.NON_SUCCESS_STATUS, status);
            }
        }

        // Exceeded max redirects without getting a successful response
        throw new RecipeFetchException(FetchErrorCode.REDIRECT_FAILURE,
                "Too many redirects (exceeded " + MAX_REDIRECTS + " hops)");
    }

    private boolean isRedirect(int statusCode) {
        return statusCode == HttpURLConnection.HTTP_MOVED_PERM ||  // 301
               statusCode == HttpURLConnection.HTTP_MOVED_TEMP ||   // 302
               statusCode == HttpURLConnection.HTTP_SEE_OTHER ||    // 303
               statusCode == 307 ||                                  // Temporary Redirect
               statusCode == 308;                                   // Permanent Redirect
    }

    private HttpClient buildHttpClient() {
        return HttpClient.newBuilder()
                .connectTimeout(TIMEOUT)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    /**
     * Processes a successful HTTP response, validates content type, decodes body, and returns the result.
     */
    private RecipeFetchResult processResponse(String originalUrl, String finalUrl, int status, HttpResponse<byte[]> response) {
        // Validate content type
        String contentType = extractContentType(response.headers().firstValue("Content-Type").orElse(null));
        if (!isAcceptedContentType(contentType)) {
            throw new RecipeFetchException(FetchErrorCode.UNSUPPORTED_CONTENT_TYPE);
        }

        byte[] bodyBytes = response.body();

        // Check size before processing
        if (bodyBytes.length > MAX_BODY_BYTES) {
            throw new RecipeFetchException(FetchErrorCode.RESPONSE_TOO_LARGE);
        }

        // Decode using charset from Content-Type header, fallback to UTF-8
        Charset charset = parseCharset(contentType).orElse(StandardCharsets.UTF_8);
        String body;
        try {
            body = new String(bodyBytes, charset);
        } catch (Exception e) {
            // Fallback: try UTF-8 if the declared charset fails
            body = new String(bodyBytes, StandardCharsets.UTF_8);
        }

        return new RecipeFetchResult(originalUrl, finalUrl, status, contentType, body, bodyBytes.length);
    }

    /**
     * Extracts the base content type (without parameters like charset) from a Content-Type header value.
     */
    static String extractContentType(String raw) {
        if (raw == null || raw.isEmpty()) return "";
        // Take only the first token before any semicolon or space
        int idx = raw.indexOf(';');
        if (idx >= 0) raw = raw.substring(0, idx);
        return raw.trim().toLowerCase();
    }

    /**
     * Checks whether a content type is accepted by this service.
     */
    static boolean isAcceptedContentType(String contentType) {
        if (contentType == null || contentType.isEmpty()) return false;
        for (String accepted : ACCEPTED_CONTENT_TYPES) {
            if (contentType.startsWith(accepted)) return true;
        }
        return false;
    }

    /**
     * Parses the charset from a Content-Type header value.
     */
    static Optional<Charset> parseCharset(String contentType) {
        if (contentType == null || contentType.isEmpty()) return Optional.empty();
        for (String param : contentType.split(";")) {
            String trimmed = param.trim().toLowerCase();
            if (trimmed.startsWith("charset=")) {
                String charsetName = trimmed.substring("charset=".length()).trim();
                try {
                    return Optional.of(Charset.forName(charsetName));
                } catch (Exception e) {
                    // Ignore invalid charsets
                }
            }
        }
        return Optional.empty();
    }
}
