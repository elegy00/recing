import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATION_FILE_RE = /^(\d+)_.+\.sql$/;

/** Directory containing the bundled migration files (works from src/ and dist/). */
export const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));

/**
 * Read all migration files (`<version>_<name>.sql`) from a directory,
 * sorted by ascending version.
 */
export async function loadMigrations(dir: string): Promise<Migration[]> {
  const entries = await readdir(dir);
  const migrations: Migration[] = [];
  for (const file of entries) {
    const match = MIGRATION_FILE_RE.exec(file);
    if (!match) continue;
    migrations.push({
      version: Number(match[1]),
      name: file,
      sql: await readFile(path.join(dir, file), "utf8"),
    });
  }
  migrations.sort((a, b) => a.version - b.version);

  const seen = new Set<number>();
  for (const m of migrations) {
    if (seen.has(m.version)) throw new Error(`Duplicate migration version: ${m.version} (${m.name})`);
    seen.add(m.version);
  }
  return migrations;
}

/** Versions already recorded in schema_migrations. */
export async function getAppliedVersions(client: pg.PoolClient): Promise<number[]> {
  const res = await client.query("SELECT version FROM schema_migrations ORDER BY version");
  return res.rows.map((r) => r.version as number);
}

/**
 * Apply all not-yet-executed migrations from `migrationsDir`.
 * Each migration runs in its own transaction and is recorded in
 * `schema_migrations` only after it succeeds. An advisory lock
 * prevents concurrent runs from racing.
 *
 * Returns the number of migrations applied.
 */
export async function runMigrations(
  pool: pg.Pool,
  migrationsDir: string,
  log: (msg: string) => void = console.log
): Promise<number> {
  const migrations = await loadMigrations(migrationsDir);
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(42)");
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version    INT PRIMARY KEY,
          name       TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);

      const applied = new Set(await getAppliedVersions(client));
      let count = 0;
      for (const m of migrations) {
        if (applied.has(m.version)) continue;
        log(`Applying ${m.name} ...`);
        await client.query("BEGIN");
        try {
          await client.query(m.sql);
          await client.query(
            "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
            [m.version, m.name]
          );
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw new Error(`Migration ${m.name} failed: ${(err as Error).message}`);
        }
        count++;
      }
      if (count === 0) log("Database is up to date.");
      return count;
    } finally {
      await client.query("SELECT pg_advisory_unlock(42)");
    }
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const url = process.env.POSTGRES_URL ?? "postgresql://recing:recing@localhost:5432/recing";
  const pool = new pg.Pool({ connectionString: url });
  try {
    await runMigrations(pool, DEFAULT_MIGRATIONS_DIR);
  } finally {
    await pool.end();
  }
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
