import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUrl, extractContentType, isAcceptedContentType, parseCharset } from "./url-fetcher.js";
import { RecipeFetchException } from "./recipe-fetch-exception.js";
import { FetchErrorCode } from "@recing/schema";
import { setDnsResolver, resetDnsResolver } from "./url-safety-validator.js";

const mockResponse: { response: Response | null } = { response: null };
const originalFetch = global.fetch;

beforeEach(async () => {
  vi.clearAllMocks();
  mockResponse.response = null;

  // Set up DNS mock that returns appropriate IPs per host
  setDnsResolver((host: string) => {
    if (host === "localhost" || host.startsWith("127.")) {
      return Promise.resolve([host === "localhost" ? "127.0.0.1" : host]);
    }
    if (/^10\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /192\.168\./.test(host)) {
      return Promise.resolve([host]);
    }
    if (host === "169.254.0.1") {
      return Promise.resolve(["169.254.0.1"]);
    }
    // Public hosts like example.com
    return Promise.resolve(["93.184.216.34"]);
  });

  global.fetch = vi.fn((input, init) => {
    if (mockResponse.response) return Promise.resolve(mockResponse.response);
    return originalFetch.call(global, input, init as RequestInit);
  });
});

afterEach(() => {
  resetDnsResolver();
});

describe("fetchUrl", () => {
  describe("successful fetches", () => {
    it("fetches HTML content and returns result", async () => {
      mockResponse.response = new Response("<html><body>Hello</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });

      const result = await fetchUrl("https://example.com/recipe");
      expect(result.originalUrl).toBe("https://example.com/recipe");
      expect(result.finalUrl).toBe("https://example.com/recipe");
      expect(result.status).toBe(200);
      expect(result.contentType).toContain("text/html");
      expect(result.body).toContain("Hello");
    });

    it("handles 304 Not Modified as success", async () => {
      mockResponse.response = new Response(null, { status: 304 });

      const result = await fetchUrl("https://example.com/recipe");
      expect(result.status).toBe(304);
    });

    it("follows a single redirect after SSRF validation", async () => {
      let callCount = 0;
      vi.mocked(global.fetch).mockImplementation(async (input, init) => {
        callCount++;
        if (callCount === 1) {
          return new Response("", { status: 301, headers: { Location: "https://example.com/recipe" } });
        }
        // Second request follows to the real page
        return new Response("<html><body>Hello</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      });

      const result = await fetchUrl("http://example.com/recipe");
      expect(result.finalUrl).toBe("https://example.com/recipe");
    });
  });

  describe("error handling", () => {
    it.each([400, 403, 404, 500, 502])("throws NON_SUCCESS_STATUS for status %d", async (status) => {
      mockResponse.response = new Response("", { status });

      try {
        await fetchUrl("https://example.com/recipe");
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as RecipeFetchException).code).toBe(FetchErrorCode.NON_SUCCESS_STATUS);
      }
    });

    it.each([301, 302, 307, 308])(
      "throws REDIRECT_FAILURE when redirect has no Location header",
      async (status) => {
        vi.mocked(global.fetch).mockImplementation(async () => {
          return new Response("", { status });
        });

        try {
          await fetchUrl("https://example.com/recipe");
          expect.fail("should have thrown");
        } catch (err) {
          expect((err as RecipeFetchException).code).toBe(FetchErrorCode.REDIRECT_FAILURE);
        }
      }
    );

    it.each([301, 302])(
      "throws REDIRECT_FAILURE on too many redirects",
      async (status) => {
        let depth = 0;
        vi.mocked(global.fetch).mockImplementation(async () => {
          depth++;
          if (depth > 6) {
            return new Response("<html><body>Done</body></html>", {
              status: 200,
              headers: { "Content-Type": "text/html" },
            });
          }
          return new Response("", {
            status,
            headers: { Location: `https://example.com/redirect/${depth}` },
          });
        });

        try {
          await fetchUrl("https://example.com/start");
          expect.fail("should have thrown");
        } catch (err) {
          expect((err as RecipeFetchException).code).toBe(FetchErrorCode.REDIRECT_FAILURE);
        }
      }
    );

    it.each([301, 302])(
      "throws UNSAFE_TARGET when redirect points to private IP",
      async (status) => {
        vi.mocked(global.fetch).mockImplementation(async () => {
          return new Response("", { status, headers: { Location: "http://192.168.1.1/internal" } });
        });

        try {
          await fetchUrl("https://example.com/recipe");
          expect.fail("should have thrown");
        } catch (err) {
          expect((err as RecipeFetchException).code).toBe(FetchErrorCode.UNSAFE_TARGET);
        }
      }
    );

    it("throws UNSUPPORTED_CONTENT_TYPE for JSON responses", async () => {
      mockResponse.response = new Response('{"key":"value"}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

      try {
        await fetchUrl("https://example.com/api");
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as RecipeFetchException).code).toBe(FetchErrorCode.UNSUPPORTED_CONTENT_TYPE);
      }
    });

    it.each(["application/pdf", "image/png", "video/mp4"])(
      "throws UNSUPPORTED_CONTENT_TYPE for binary: '%s'",
      async (contentType) => {
        mockResponse.response = new Response("binary data", {
          status: 200,
          headers: { "Content-Type": contentType },
        });

        try {
          await fetchUrl("https://example.com/file");
          expect.fail("should have thrown");
        } catch (err) {
          expect((err as RecipeFetchException).code).toBe(FetchErrorCode.UNSUPPORTED_CONTENT_TYPE);
        }
      }
    );

    it.each([301, 302])(
      "throws RESPONSE_TOO_LARGE for oversized bodies",
      async (status) => {
        let callCount = 0;
        vi.mocked(global.fetch).mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            return new Response("", { status, headers: { Location: "https://example.com/large" } });
          }
          const largeBody = new ArrayBuffer((5 * 1024 * 1024 + 1));
          return new Response(largeBody, {
            status: 200,
            headers: { "Content-Type": "text/html" },
          });
        });

        try {
          await fetchUrl("https://example.com/redirect");
          expect.fail("should have thrown");
        } catch (err) {
          expect((err as RecipeFetchException).code).toBe(FetchErrorCode.RESPONSE_TOO_LARGE);
        }
      }
    );

    it("throws FETCH_FAILED for unexpected errors", async () => {
      vi.mocked(global.fetch).mockImplementation(() => Promise.reject(new Error("kaboom")));

      try {
        await fetchUrl("https://example.com/recipe");
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as RecipeFetchException).code).toBe(FetchErrorCode.FETCH_FAILED);
      }
    });

    it("throws UNREACHABLE_HOST for connection refused", async () => {
      vi.mocked(global.fetch).mockImplementation(() => Promise.reject(new Error("ECONNREFUSED")));

      try {
        await fetchUrl("https://example.com/recipe");
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as RecipeFetchException).code).toBe(FetchErrorCode.UNREACHABLE_HOST);
      }
    });

    it("throws UNREACHABLE_HOST for DNS/network failure", async () => {
      vi.mocked(global.fetch).mockImplementation(() => Promise.reject(new Error("ENOTFOUND")));

      try {
        await fetchUrl("https://example.com/recipe");
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as RecipeFetchException).code).toBe(FetchErrorCode.UNREACHABLE_HOST);
      }
    });
  });

  describe("URL validation", () => {
    it("rejects invalid URLs before fetching", async () => {
      try {
        await fetchUrl("not-a-url");
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as RecipeFetchException).code).toBe(FetchErrorCode.INVALID_URL);
      }
    });

    it("rejects file:// scheme", async () => {
      try {
        await fetchUrl("file:///etc/passwd");
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as RecipeFetchException).code).toBe(FetchErrorCode.INVALID_URL);
      }
    });

    it("rejects localhost URLs", async () => {
      try {
        await fetchUrl("http://localhost/recipe");
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as RecipeFetchException).code).toBe(FetchErrorCode.UNSAFE_TARGET);
      }
    });

    it("trims whitespace from submitted URL", async () => {
      mockResponse.response = new Response("<html><body>Hello</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });

      const result = await fetchUrl("  https://example.com/recipe  ");
      expect(result.originalUrl).toBe("https://example.com/recipe");
    });
  });

  describe("request configuration", () => {
    it("sends correct headers to native fetch", async () => {
      mockResponse.response = new Response("<html><body>Hello</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });

      await fetchUrl("https://example.com/recipe");
      const call = vi.mocked(global.fetch).mock.calls[0];
      const init = call[1] as RequestInit;

      let headersObj: Record<string, string> = {};
      if (init.headers instanceof Headers) {
        headersObj = Object.fromEntries(init.headers.entries());
      } else if (typeof init.headers === "object" && init.headers !== null) {
        headersObj = init.headers as Record<string, string>;
      }

      expect(headersObj["User-Agent"]).toBe("Recing/1.0 (Recipe Extractor)");
      expect(headersObj["Accept"]).toBe(
        "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5,*/*;q=0.1"
      );
    });

    it("uses manual redirect mode to prevent auto-following", async () => {
      let firstCall = true;
      vi.mocked(global.fetch).mockImplementation(async (input, init) => {
        if (firstCall) {
          firstCall = false;
          return new Response("", { status: 302, headers: { Location: "https://example.com/redirected" } });
        }
        return new Response("<html><body>Hello</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      });

      await fetchUrl("https://example.com/recipe");

      const call = vi.mocked(global.fetch).mock.calls[0];
      const init = call[1] as RequestInit;
      expect(init.redirect).toBe("manual");
    });

    it("uses GET method", async () => {
      mockResponse.response = new Response("<html><body>Hello</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });

      await fetchUrl("https://example.com/recipe");
      const call = vi.mocked(global.fetch).mock.calls[0];
      const init = call[1] as RequestInit;
      expect(init.method).toBe("GET");
    });
  });
});

describe("extractContentType", () => {
  it.each([
    ["text/html; charset=utf-8", "text/html"],
    ["application/xhtml+xml", "application/xhtml+xml"],
    ["TEXT/HTML", "text/html"],
    [null, ""],
    ["", ""],
    ["text/html; boundary=something", "text/html"],
  ])("extracts '%s' → '%s'", (raw, expected) => {
    expect(extractContentType(raw)).toBe(expected);
  });
});

describe("isAcceptedContentType", () => {
  it.each([
    ["text/html", true],
    ["text/plain", true],
    ["application/xhtml+xml", true],
    ["text/html; charset=utf-8", true],
    ["application/json", false],
    ["image/png", false],
    [null, false],
    ["", false],
  ])("isAcceptedContentType('%s') → %s", (ct, expected) => {
    expect(isAcceptedContentType(ct)).toBe(expected);
  });
});

describe("parseCharset", () => {
  it.each([
    ["text/html; charset=utf-8", "utf-8"],
    ["text/plain; charset=iso-8859-1", "iso-8859-1"],
    ["text/html", undefined],
    [null, undefined],
    ["", undefined],
    // Invalid/missing charset should be ignored gracefully
    ["text/html; charset=", undefined],
  ])("parseCharset('%s') → %s", (ct, expected) => {
    expect(parseCharset(ct)).toBe(expected);
  });
});
