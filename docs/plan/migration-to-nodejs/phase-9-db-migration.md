# Phase 9: Database Migration (MongoDB → Postgres)

## Goal
Migrate existing data from the MongoDB database to Postgres with a safe, repeatable process.

## Steps

### Step 9.1 — Postgres schema

Define the `jobs` table schema:

```sql
CREATE TABLE jobs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url        TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'PENDING',
    result     JSONB,
    error      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_status_created_asc ON jobs (status, created_at ASC);
```

### Step 9.2 — Migration script

`packages/migrate/src/index.ts` — one-time script:
1. Connects to source MongoDB and counts documents per status
2. Shows summary (`PENDING: 5, COMPLETED: 42, FAILED: 3`)
3. Asks for confirmation
4. Copies all documents to Postgres, mapping:
   - `_id` (string UUID) → `id` (UUID)
   - `result` (MongoDB doc) → `result` (JSONB)
   - `status` → `status`
   - Adds `created_at`, `updated_at` from MongoDB timestamps

### Step 9.3 — node-pg-migrate setup

For ongoing migrations (schema changes), set up `node-pg-migrate`:
```bash
cd packages/migrate && pnpm add -D node-pg-migrate
```

Runs via `pnpm migrate:up` against `POSTGRES_URL`.

## Dependencies
Phase 8 (Deployment) — needs Postgres instance running and accessible.
