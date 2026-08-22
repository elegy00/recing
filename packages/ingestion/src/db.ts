import pg from "pg";

let pool: pg.Pool | null = null;

function getConnectionString(): string {
  return process.env.POSTGRES_URL ?? "postgresql://recing:recing@localhost:5432/recing";
}

/** Get or create the Postgres connection pool. */
export function getDb(): pg.Pool {
  if (!pool) {
    const connectionString = getConnectionString();
    pool = new pg.Pool({ connectionString });
    // Log the target (password masked) so a wrong/missing POSTGRES_URL is visible immediately.
    console.warn(`[db] Connecting to ${maskPassword(connectionString)}`);
  }
  return pool;
}

/** Mask the password in a connection URL for safe logging. */
export function maskPassword(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return url;
  }
}

/** Close the pool (for graceful shutdown). */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
