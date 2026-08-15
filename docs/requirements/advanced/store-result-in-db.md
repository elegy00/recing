## Store Result in DB

### Goal
Persist the LLM-extracted recipe result in Postgres so it survives pod restarts and can be viewed later.

### Functional requirements
1. On successful LLM extraction, the ingestion worker shall store the parsed recipe data in the `jobs.result` JSONB column.
2. The result must include at minimum: recipe name, ingredients (array), instructions (array), source URL, servings, prep time, cook time, notes.
3. The worker shall atomically update `status` → `COMPLETED` and set `updated_at` on success.
4. On extraction failure, the worker shall atomically update `status` → `FAILED`, store the error message in `error`, and set `updated_at`.
5. All writes must use parameterized queries — no string interpolation for user data.

### Postgres schema impact
- `result` column is JSONB — no schema migration needed for field changes.
- `status` is TEXT, not a DB-level enum, to keep migrations simple.

### Acceptance criteria
- A successful extraction writes the structured recipe as JSONB into the `result` column.
- A failed extraction writes an error message into the `error` column and sets `status` to `FAILED`.
- The result is queryable via `SELECT result FROM jobs WHERE id = $1` and returns valid JSON.
- Concurrent updates to the same job are safe (handled by `SKIP LOCKED` in worker).
