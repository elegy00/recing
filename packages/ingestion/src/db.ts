import pg from "pg";

let pool: pg.Pool | null = null;

function getConnectionString(): string {
  return process.env.POSTGRES_URL ?? "postgresql://recing:recing@localhost:5432/recing";
}

/** Get or create the Postgres connection pool. */
export function getDb(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: getConnectionString() });
  }
  return pool;
}

/** Close the pool (for graceful shutdown). */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
