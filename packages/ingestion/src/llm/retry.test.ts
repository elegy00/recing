import { describe, expect, it, vi } from "vitest";
import { withRetry } from "./retry.js";

const error = (msg: string) => new Error(msg);

describe("withRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries after a failure and returns the second result", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(error("first"))
      .mockResolvedValueOnce("second");

    await expect(withRetry(fn, { delayMs: 1 })).resolves.toBe("second");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws the last error when all attempts fail", async () => {
    const fn = vi.fn().mockRejectedValue(error("always"));

    await expect(withRetry(fn, { delayMs: 1 })).rejects.toThrow("always");
    expect(fn).toHaveBeenCalledTimes(2); // default maxAttempts
  });

  it("respects a custom maxAttempts", async () => {
    const fn = vi.fn().mockRejectedValue(error("always"));

    await expect(withRetry(fn, { delayMs: 1, maxAttempts: 3 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives up immediately when onFailure returns false", async () => {
    const fn = vi.fn().mockRejectedValue(error("fatal"));
    const onFailure = vi.fn().mockReturnValue(false);

    await expect(withRetry(fn, { delayMs: 1, onFailure })).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(expect.any(Error), 1, 2);
  });

  it("retries when onFailure returns true", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(error("first"))
      .mockResolvedValueOnce("done");
    const onFailure = vi.fn().mockReturnValue(true);

    await expect(withRetry(fn, { delayMs: 1, onFailure })).resolves.toBe("done");
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});
