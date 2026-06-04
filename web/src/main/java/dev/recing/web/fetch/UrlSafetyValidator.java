package dev.recing.web.fetch;

import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;

/**
 * Validates URLs for safety before making network requests.
 * Checks syntax, scheme, and DNS resolution to prevent SSRF attacks.
 */
public class UrlSafetyValidator {

    private UrlSafetyValidator() {}

    /**
     * Validates a submitted URL string for safety.
     * @param rawUrl the raw user input
     * @return the validated URI if safe
     * @throws RecipeFetchException if validation fails with an appropriate error code
     */
    public static URI validate(String rawUrl) {
        String trimmed = rawUrl == null ? "" : rawUrl.trim();
        if (trimmed.isEmpty()) {
            throw new RecipeFetchException(FetchErrorCode.INVALID_URL);
        }

        URI uri;
        try {
            uri = new URI(trimmed);
        } catch (URISyntaxException e) {
            throw new RecipeFetchException(FetchErrorCode.INVALID_URL);
        }

        // Must be absolute (have scheme and authority/host)
        if (!uri.isAbsolute()) {
            throw new RecipeFetchException(FetchErrorCode.INVALID_URL);
        }

        // Only allow http and https schemes
        String scheme = uri.getScheme();
        if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
            throw new RecipeFetchException(FetchErrorCode.INVALID_URL);
        }

        // Reject userinfo credentials (user:pass@host)
        if (uri.getUserInfo() != null && !uri.getUserInfo().isEmpty()) {
            throw new RecipeFetchException(FetchErrorCode.UNSAFE_TARGET);
        }

        String host = uri.getHost();
        if (host == null || host.isEmpty()) {
            throw new RecipeFetchException(FetchErrorCode.INVALID_URL);
        }

        // Validate port if specified
        int port = uri.getPort();
        if (port < -1 || port > 65535) {
            throw new RecipeFetchException(FetchErrorCode.UNSAFE_TARGET);
        }

        return resolveAndValidateHost(host, trimmed);
    }

    /**
     * Resolves the host via DNS and validates that no resolved address is unsafe.
     */
    private static URI resolveAndValidateHost(String host, String originalUrl) {
        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            for (InetAddress addr : addresses) {
                if (!isPublicAddress(addr)) {
                    throw new RecipeFetchException(FetchErrorCode.UNSAFE_TARGET);
                }
            }
        } catch (java.net.UnknownHostException e) {
            // Host exists but couldn't resolve — treat as invalid URL for now
            throw new RecipeFetchException(FetchErrorCode.INVALID_URL);
        }

        try {
            return new URI(originalUrl.trim());
        } catch (URISyntaxException e) {
            throw new RecipeFetchException(FetchErrorCode.INVALID_URL);
        }
    }

    /**
     * Checks whether an IP address is a public (externally reachable) address.
     * Returns false for any private, loopback, link-local, multicast, or unspecified address.
     */
    static boolean isPublicAddress(InetAddress addr) {
        if (addr.isAnyLocalAddress() ||
            addr.isLoopbackAddress() ||
            addr.isLinkLocalAddress() ||
            addr.isSiteLocalAddress() ||
            addr.isMulticastAddress()) {
            return false;
        }

        // Additional IPv4 private range checks for clarity
        byte[] bytes = addr.getAddress();
        if (bytes.length == 4) {
            int firstByte = bytes[0] & 0xFF;
            int secondByte = bytes[1] & 0xFF;

            // 10.0.0.0/8
            if (firstByte == 10) return false;
            // 172.16.0.0/12
            if (firstByte == 172 && secondByte >= 16 && secondByte <= 31) return false;
            // 192.168.0.0/16
            if (firstByte == 192 && secondByte == 168) return false;
            // 127.0.0.0/8 (also caught by isLoopbackAddress, but explicit for clarity)
            if (firstByte == 127) return false;
            // 169.254.0.0/16 link-local (also caught by isLinkLocalAddress)
            if (firstByte == 169 && secondByte == 254) return false;

            // ::ffff:private-ipv4 mapped addresses
            if (firstByte == 0 && secondByte == 0) {
                int third = bytes[2] & 0xFF;
                int fourth = bytes[3] & 0xFF;
                // Check for IPv4-mapped IPv6 private ranges
                if (third == 0 && fourth == 0) return false; // ::
            }
        }

        // Additional IPv6 checks
        if (bytes.length == 16) {
            int b0 = bytes[0] & 0xFF;
            int b1 = bytes[1] & 0xFF;
            // fc00::/7 (unique local addresses)
            if ((b0 & 0xFE) == 0xFC) return false;
            // fe80::/10 (link-local unicast, also caught by isLinkLocalAddress)
            if ((b0 & 0xFF) == 0xFE && (b1 & 0xC0) == 0x80) return false;
        }

        return true;
    }
}
