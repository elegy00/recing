import { describe, it, expect } from "vitest";
import { describeError } from "./error-utils.js";

describe("describeError", () => {
  it("describes a plain Error with name and message", () => {
    expect(describeError(new Error("network error"))).toBe("Error: network error");
  });

  it("includes the errno code when present", () => {
    const err = new Error("connect ECONNREFUSED 127.0.0.1:5432") as NodeJS.ErrnoException;
    err.code = "ECONNREFUSED";
    expect(describeError(err)).toBe("Error: connect ECONNREFUSED 127.0.0.1:5432 (ECONNREFUSED)");
  });

  it("expands an AggregateError with an empty message (Node happy-eyeballs case)", () => {
    // Reproduces what Node >= 20 net.connect throws when every resolved address fails:
    // a bare AggregateError whose String() is just "AggregateError".
    const refused = (addr: string) => {
      const e = new Error(`connect ECONNREFUSED ${addr}`) as NodeJS.ErrnoException;
      e.code = "ECONNREFUSED";
      return e;
    };
    const agg = new AggregateError([refused("::1:5432"), refused("127.0.0.1:5432")]);

    const text = describeError(agg);
    expect(text).toContain("AggregateError");
    expect(text).toContain("connect ECONNREFUSED ::1:5432 (ECONNREFUSED)");
    expect(text).toContain("connect ECONNREFUSED 127.0.0.1:5432 (ECONNREFUSED)");
  });

  it("keeps the AggregateError message when set", () => {
    const agg = new AggregateError([new Error("a")], "all attempts failed");
    expect(describeError(agg)).toBe("all attempts failed [Error: a]");
  });

  it("follows the .cause chain (fetch failure case)", () => {
    const cause = new Error("getaddrinfo ENOTFOUND example.invalid") as NodeJS.ErrnoException;
    cause.code = "ENOTFOUND";
    const err = new TypeError("fetch failed", { cause });

    expect(describeError(err)).toBe(
      "TypeError: fetch failed | caused by: Error: getaddrinfo ENOTFOUND example.invalid (ENOTFOUND)"
    );
  });

  it("handles string causes", () => {
    const err = new TypeError("boom", { cause: "inner failure" });
    expect(describeError(err)).toBe("TypeError: boom | caused by: inner failure");
  });

  it("does not recurse infinitely on circular causes", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    (a as { cause?: unknown }).cause = b;

    expect(() => describeError(a)).not.toThrow();
    expect(describeError(a)).toContain("Error: a");
  });

  it("falls back to String() for non-error values", () => {
    expect(describeError("plain string")).toBe("plain string");
    expect(describeError(null)).toBe("null");
    expect(describeError(42)).toBe("42");
  });
});
