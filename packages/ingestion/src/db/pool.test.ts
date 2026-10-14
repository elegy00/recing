import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import { getDb, closeDb, maskPassword } from "./db.js";

const DEFAULT_URL = "postgresql://recing:recing@localhost:5432/recing";

describe("getDb", () => {
  const originalUrl = process.env.POSTGRES_URL;
  let warnSpy: MockInstance;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    await closeDb(); // reset the cached pool so each test starts fresh
    if (originalUrl === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = originalUrl;
    vi.restoreAllMocks();
  });

  it("uses POSTGRES_URL when set", async () => {
    process.env.POSTGRES_URL = "postgresql://user:pass@db.example.com:5432/mydb";
    const db = getDb();
    expect(db.options.connectionString).toBe("postgresql://user:pass@db.example.com:5432/mydb");
  });

  it("falls back to the local default when POSTGRES_URL is unset", async () => {
    delete process.env.POSTGRES_URL;
    const db = getDb();
    expect(db.options.connectionString).toBe(DEFAULT_URL);
  });

  it("logs the connection target with a masked password", async () => {
    process.env.POSTGRES_URL = "postgresql://user:secret@db.example.com:5432/mydb";
    getDb();
    const warnCalls = warnSpy.mock.calls.map((c) => c.join(" "));
    expect(warnCalls.some((l) => l.includes("[db] Connecting to"))).toBe(true);
    expect(warnCalls.join("\n")).not.toContain("secret");
  });

  it("reuses the existing pool on subsequent calls", async () => {
    const a = getDb();
    const b = getDb();
    expect(a).toBe(b);
  });
});

describe("maskPassword", () => {
  it("masks the password in a URL", () => {
    expect(maskPassword("postgresql://user:secret@host:5432/db")).toBe(
      "postgresql://user:***@host:5432/db"
    );
  });

  it("leaves URLs without a password unchanged", () => {
    expect(maskPassword("postgresql://user@host:5432/db")).toBe("postgresql://user@host:5432/db");
  });

  it("returns the input as-is when it is not a valid URL", () => {
    expect(maskPassword("not a url")).toBe("not a url");
  });
});
