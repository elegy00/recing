import { describe, expect, it } from "vitest";
import { extractContentType, isAcceptedContentType, parseCharset } from "./content-type.js";

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
    [null as unknown as string, false],
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
    [null as unknown as string, undefined],
    ["", undefined],
    // Invalid/missing charset should be ignored gracefully
    ["text/html; charset=", undefined],
  ])("parseCharset('%s') → %s", (ct, expected) => {
    expect(parseCharset(ct)).toBe(expected);
  });
});
