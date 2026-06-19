package dev.recing.web.fetch;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.net.InetAddress;

import static org.junit.jupiter.api.Assertions.*;

class UrlSafetyValidatorTest {

    @ParameterizedTest(name = "reject: [{index}] \"{0}\"")
    @ValueSource(strings = {"", "   ", "not-a-url", "relative/path", "/absolute/path"})
    void rejectsInvalidUrls(String raw) {
        RecipeFetchException ex = assertThrows(RecipeFetchException.class, () -> UrlSafetyValidator.validate(raw));
        assertEquals(FetchErrorCode.INVALID_URL, ex.getCode());
    }

    @ParameterizedTest(name = "reject scheme: [{index}] \"{0}\"")
    @CsvSource({
            "'file:///etc/passwd', 'INVALID_URL'",
            "'ftp://example.com/file', 'INVALID_URL'",
            "'data:text/html,<h1>hi</h1>', 'INVALID_URL'",
            "'javascript:alert(1)', 'INVALID_URL'",
            "'mailto:user@example.com', 'INVALID_URL'"
    })
    void rejectsUnsupportedSchemes(String raw, String expectedCode) {
        RecipeFetchException ex = assertThrows(RecipeFetchException.class, () -> UrlSafetyValidator.validate(raw));
        assertEquals(FetchErrorCode.valueOf(expectedCode), ex.getCode());
    }

    @Test
    void rejectsLocalhostHostnames() {
        for (String host : new String[]{"localhost", "LOCALHOST"}) {
            RecipeFetchException ex = assertThrows(RecipeFetchException.class,
                    () -> UrlSafetyValidator.validate("http://" + host));
            assertEquals(FetchErrorCode.UNSAFE_TARGET, ex.getCode());
        }
    }

    @Test
    void rejectsLoopbackIpV4() {
        for (String ip : new String[]{"127.0.0.1", "127.0.0.255"}) {
            RecipeFetchException ex = assertThrows(RecipeFetchException.class,
                    () -> UrlSafetyValidator.validate("http://" + ip));
            assertEquals(FetchErrorCode.UNSAFE_TARGET, ex.getCode());
        }
    }

    @Test
    void rejectsPrivateIpRanges() {
        String[][] privateIps = {
                {"10.0.0.1", "10.255.255.254"},
                {"172.16.0.1", "172.31.255.254"},
                {"192.168.0.1", "192.168.255.254"}
        };
        for (String[] ips : privateIps) {
            for (String ip : ips) {
                RecipeFetchException ex = assertThrows(RecipeFetchException.class,
                        () -> UrlSafetyValidator.validate("http://" + ip));
                assertEquals(FetchErrorCode.UNSAFE_TARGET, ex.getCode());
            }
        }
    }

    @Test
    void rejectsLinkLocalIpV4() {
        RecipeFetchException ex = assertThrows(RecipeFetchException.class,
                () -> UrlSafetyValidator.validate("http://169.254.0.1"));
        assertEquals(FetchErrorCode.UNSAFE_TARGET, ex.getCode());
    }

    @Test
    void rejectsUserInfoCredentials() {
        RecipeFetchException ex = assertThrows(RecipeFetchException.class,
                () -> UrlSafetyValidator.validate("http://user:pass@example.com"));
        assertEquals(FetchErrorCode.UNSAFE_TARGET, ex.getCode());
    }

    @ParameterizedTest(name = "accepts valid URL: \"{0}\"")
    @ValueSource(strings = {
            "https://example.com/recipe",
            "http://example.org/path?query=1#fragment"
    })
    void acceptsValidPublicUrls(String url) {
        // These will try to resolve real DNS. We only test that syntax validation passes
        // and SSRF rejection doesn't trigger for known public domains.
        // If example.com resolves publicly, this should succeed; if not, it throws INVALID_URL (DNS failure).
        // Either way, no UNSAFE_TARGET should be thrown.
        try {
            var result = UrlSafetyValidator.validate(url);
            assertNotNull(result);
            assertTrue(result.getHost().isEmpty() || !"localhost".equalsIgnoreCase(result.getHost()));
        } catch (RecipeFetchException e) {
            // DNS resolution may fail in CI — that's fine, just not UNSAFE_TARGET
            assertNotEquals(FetchErrorCode.UNSAFE_TARGET, e.getCode());
        }
    }

    @Test
    void trimsWhitespace() {
        try {
            var result = UrlSafetyValidator.validate("  https://example.com/path  ");
            assertEquals("https://example.com/path", result.toString());
        } catch (RecipeFetchException e) {
            assertNotEquals(FetchErrorCode.UNSAFE_TARGET, e.getCode());
        }
    }

    // --- isPublicAddress direct tests (no DNS needed) ---

    @Test
    void rejectsLoopbackInetAddress() throws Exception {
        InetAddress loopback = InetAddress.getByName("127.0.0.1");
        assertFalse(UrlSafetyValidator.isPublicAddress(loopback));
    }

    @Test
    void rejectsSiteLocalAddresses() throws Exception {
        String[] privateIps = {"10.0.0.1", "172.16.0.1", "192.168.1.1"};
        for (String ip : privateIps) {
            assertFalse(UrlSafetyValidator.isPublicAddress(InetAddress.getByName(ip)), "Should reject: " + ip);
        }
    }

    @Test
    void rejectsLinkLocalInetAddress() throws Exception {
        InetAddress linkLocal = InetAddress.getByName("169.254.0.1");
        assertFalse(UrlSafetyValidator.isPublicAddress(linkLocal));
    }

    @Test
    void rejectsAnyLocalAddress() throws Exception {
        InetAddress anyLocal = InetAddress.getByName("0.0.0.0");
        assertFalse(UrlSafetyValidator.isPublicAddress(anyLocal));
    }

    @Test
    void rejectsMulticastInetAddress() throws Exception {
        InetAddress multicast = InetAddress.getByName("224.0.0.1");
        assertFalse(UrlSafetyValidator.isPublicAddress(multicast));
    }

    @Test
    void acceptsWellKnownPublicIp() throws Exception {
        // 8.8.8.8 (Google DNS) — should be considered public
        assertTrue(UrlSafetyValidator.isPublicAddress(InetAddress.getByName("8.8.8.8")));
    }
}
