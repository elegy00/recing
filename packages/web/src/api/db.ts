import { Pool } from "pg";

let _pool: Pool | null = null;

/** Shared pg pool, created lazily on first use. */
export function getPool(): Pool {
	if (!_pool) {
		const url =
			process.env.POSTGRES_URL ??
			"postgresql://recing:recing@localhost:5432/recing";
		_pool = new Pool({ connectionString: url });
	}
	return _pool;
}

/** pg may return timestamptz columns as Date or string; normalize to ISO. */
export function toIsoString(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : value;
}
