import { describe, it, expect } from "vitest";
import { JobStatus } from "./errors.js";
import { validateJobSubmission } from "./job-submission.js";

describe("validateJobSubmission", () => {
  const valid = {
    id: "60d5ec49f1b2c8b1a8e4f0a1",
    url: "https://example.com/recipe",
    status: JobStatus.PENDING,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    result: null,
    error: null,
  };

  it("accepts a valid job submission", () => {
    const result = validateJobSubmission(valid);
    expect(result.url).toBe("https://example.com/recipe");
    expect(result.status).toBe(JobStatus.PENDING);
  });

  it("rejects invalid URL", () => {
    const bad = { ...valid, url: "not-a-url" };
    expect(() => validateJobSubmission(bad)).toThrow();
  });

  it("rejects unknown status enum value", () => {
    const bad = { ...valid, status: "UNKNOWN" as JobStatus };
    expect(() => validateJobSubmission(bad)).toThrow();
  });

  it("accepts optional fields omitted", () => {
    const minimal = { url: "https://x.com", status: JobStatus.PENDING };
    const result = validateJobSubmission(minimal);
    expect(result.id).toBeUndefined();
    expect(result.createdAt).toBeUndefined();
    expect(result.result).toBeUndefined();
  });

  it("accepts all valid statuses", () => {
    for (const status of Object.values(JobStatus)) {
      const result = validateJobSubmission({ ...valid, status });
      expect(result.status).toBe(status);
    }
  });

  it("coerces date strings to Date objects", () => {
    const withStrings = { ...valid, createdAt: "2025-01-01T00:00:00Z" };
    const result = validateJobSubmission(withStrings);
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it("rejects missing required fields", () => {
    const bad = { url: "https://x.com" } as unknown;
    expect(() => validateJobSubmission(bad)).toThrow();
  });
});
