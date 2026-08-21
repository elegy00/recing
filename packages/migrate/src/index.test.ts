import { describe, it, expect } from "vitest";
import pg from "pg";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runMigrations, loadMigrations, getAppliedVersions } from "./index.js";

const BASE_URL =
  process.env.TEST_POSTGRES_URL ||
  process.env.POSTGRES_URL ||
  "postgresql://recing:recing@localhost:5432/recing";

/** Create a scratch database, run `fn` against it, then drop it. */
async function withScratchDb<T>(fn: (dbUrl: string) => Promise<T>): Promise<T> {
  const name = `migrate_test_${Math.random().toString(36).slice(2, 10)}`;
  const admin = new pg.Pool({ connectionString: BASE_URL });
  await admin.query(`CREATE DATABASE ${name}`);
  try {
    const u = new URL(BASE_URL);
    u.pathname = `/${name}`;
    return await fn(u.toString());
  } finally {
    await admin.query(`DROP DATABASE ${name}`);
    await admin.end();
  }
}

/** Create a temp dir containing the given migration files. */
function makeMigrationsDir(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "migrate-test-"));
  for (const [name, sql] of Object.entries(files)) writeFileSync(path.join(dir, name), sql);
  return dir;
}

async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
  const res = await pool.query("SELECT to_regclass('public.$1') AS t", [table]);
  return res.rows[0].t !== null;
}

describe("loadMigrations", () => {
  it("loads and sorts migrations by version, ignoring non-matching files", async () => {
    const dir = makeMigrationsDir({
      "10_second.sql": "SELECT 1;",
      "2_first.sql": "SELECT 2;",
      "README.md": "not a migration",
    });
    try {
      const migrations = await loadMigrations(dir);
      expect(migrations.map((m) => m.version)).toEqual([2, 10]);
      expect(migrations[0].sql).toBe("SELECT 2;");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects duplicate versions", async () => {
    const dir = makeMigrationsDir({
      "1_a.sql": "SELECT 1;",
      "1_b.sql": "SELECT 2;",
    });
    try {
      await expect(loadMigrations(dir)).rejects.toThrow(/Duplicate migration version/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("runMigrations", () => {
  it("applies all pending migrations to an empty database", async () => {
    const dir = makeMigrationsDir({
      "001_create_foo.sql": "CREATE TABLE foo (id INT);",
      "002_create_bar.sql": "CREATE TABLE bar (id INT);",
    });
    await withScratchDb(async (dbUrl) => {
      const pool = new pg.Pool({ connectionString: dbUrl });
      try {
        const applied = await runMigrations(pool, dir, () => {});
        expect(applied).toBe(2);

        const client = await pool.connect();
        try {
          expect(await getAppliedVersions(client)).toEqual([1, 2]);
        } finally {
          client.release();
        }
        expect(await tableExists(pool, "foo")).toBe(true);
        expect(await tableExists(pool, "bar")).toBe(true);
      } finally {
        await pool.end();
      }
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it("is idempotent — a second run applies nothing", async () => {
    const dir = makeMigrationsDir({ "001_create_foo.sql": "CREATE TABLE foo (id INT);" });
    await withScratchDb(async (dbUrl) => {
      const pool = new pg.Pool({ connectionString: dbUrl });
      try {
        expect(await runMigrations(pool, dir, () => {})).toBe(1);
        expect(await runMigrations(pool, dir, () => {})).toBe(0);
      } finally {
        await pool.end();
      }
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it("applies only newly added migrations on re-run", async () => {
    const dir = makeMigrationsDir({ "001_create_foo.sql": "CREATE TABLE foo (id INT);" });
    await withScratchDb(async (dbUrl) => {
      const pool = new pg.Pool({ connectionString: dbUrl });
      try {
        expect(await runMigrations(pool, dir, () => {})).toBe(1);

        writeFileSync(path.join(dir, "002_create_bar.sql"), "CREATE TABLE bar (id INT);");
        expect(await runMigrations(pool, dir, () => {})).toBe(1);

        const client = await pool.connect();
        try {
          expect(await getAppliedVersions(client)).toEqual([1, 2]);
        } finally {
          client.release();
        }
        expect(await tableExists(pool, "bar")).toBe(true);
      } finally {
        await pool.end();
      }
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it("applies migrations in version order, not file order", async () => {
    // Alphabetically "10_" sorts before "2_", but version 2 must run first.
    const dir = makeMigrationsDir({
      "2_create_a.sql": "CREATE TABLE a (id INT);",
      "10_insert_from_a.sql": "CREATE TABLE b (id INT); INSERT INTO b SELECT id FROM a;",
    });
    await withScratchDb(async (dbUrl) => {
      const pool = new pg.Pool({ connectionString: dbUrl });
      try {
        expect(await runMigrations(pool, dir, () => {})).toBe(2);
        expect(await tableExists(pool, "b")).toBe(true);
      } finally {
        await pool.end();
      }
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it("rolls back a failing migration and does not record it", async () => {
    const dir = makeMigrationsDir({ "001_create_foo.sql": "CREATE TABLE foo (id INT);" });
    await withScratchDb(async (dbUrl) => {
      const pool = new pg.Pool({ connectionString: dbUrl });
      try {
        expect(await runMigrations(pool, dir, () => {})).toBe(1);

        writeFileSync(
          path.join(dir, "002_bad.sql"),
          "CREATE TABLE baz (id INT); INSERT INTO does_not_exist VALUES (1);"
        );
        await expect(runMigrations(pool, dir, () => {})).rejects.toThrow(/002_bad\.sql failed/);

        // Nothing from the failed migration may remain.
        const client = await pool.connect();
        try {
          expect(await getAppliedVersions(client)).toEqual([1]);
        } finally {
          client.release();
        }
        expect(await tableExists(pool, "baz")).toBe(false);

        // Fixing the migration and re-running succeeds.
        writeFileSync(path.join(dir, "002_bad.sql"), "CREATE TABLE baz (id INT);");
        expect(await runMigrations(pool, dir, () => {})).toBe(1);
        expect(await tableExists(pool, "baz")).toBe(true);
      } finally {
        await pool.end();
      }
    });
    rmSync(dir, { recursive: true, force: true });
  });
});
