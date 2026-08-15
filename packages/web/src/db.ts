import type { Pool } from "pg";
import pg from "pg";

let pool: Pool | null = null;
const MAIN_DB = "recing";

/** Test hook — set a fake pool to bypass real Postgres. */
export function getTestPool(): Pool | undefined {
  return (globalThis as Record<string, unknown>).__recingTestPool as Pool | undefined;
}

/** Set a test pool (e.g. pg-mem) for testing. */
export function setTestPool(p: Pool): void {
  (globalThis as Record<string, unknown>).__recingTestPool = p;
}

/** Clear the test pool (resets to production mode). */
export function clearTestPool(): void {
  delete (globalThis as Record<string, unknown>).__recingTestPool;
}

/** Create a pool connected to a test database. */
export function createTestPool(): Pool {
  const url = process.env.TEST_POSTGRES_URL || process.env.POSTGRES_URL || "postgresql://recing:recing@localhost:5432/recing";
  const testUrl = url.replace(new RegExp(`/${MAIN_DB}(\\?.*)?$`), "/recing_test$2");
  return new pg.Pool({ connectionString: testUrl });
}

/** Get or create the Postgres connection pool. */
export function getDb(): Promise<Pool> {
  const testPool = getTestPool();
  if (testPool) return Promise.resolve(testPool);
  if (!pool) {
    const url = process.env.POSTGRES_URL ?? "postgresql://recing:recing@localhost:5432/recing";
    pool = new pg.Pool({ connectionString: url });
  }
  return Promise.resolve(pool);
}

/** Run a query and return rows. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const db = await getDb();
  const res = await db.query(sql, params);
  return res.rows as T[];
}

/** Run a query that returns a single row (or null). */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/** Run a query that returns a single value (or null). */
export async function queryValue<T = unknown>(
  _sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const row = await queryOne<{ value: T }>("SELECT $1::text AS value", params);
  return row?.value ?? null;
}

/** Close the database pool (useful for tests / shutdown). */
export async function closeDb(): Promise<void> {
  if (pool && !getTestPool()) {
    await pool.end();
    pool = null;
  }
}
