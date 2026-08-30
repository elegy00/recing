-- ── Photo-based recipe ingestion tables ──────────────────────────────
-- Separate from URL-based jobs. Each photo job has 1-N chunks, processed sequentially.

CREATE TABLE IF NOT EXISTS photo_jobs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status      TEXT NOT NULL DEFAULT 'PENDING',       -- PENDING | CHUNKING | MERGING | COMPLETED | FAILED
    total_photos INTEGER NOT NULL DEFAULT 0,
    completed_chunks INTEGER NOT NULL DEFAULT 0,
    error       TEXT,
    result      JSONB,                                   -- final RecipeExtraction (set on COMPLETED)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photo_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          UUID NOT NULL REFERENCES photo_jobs(id) ON DELETE CASCADE,
    order_num       INTEGER NOT NULL,                    -- processing order (0-based)
    status          TEXT NOT NULL DEFAULT 'PENDING',     -- PENDING | EXTRACTING | EXTRACTED | FAILED
    data_uri        TEXT NOT NULL,                       -- base64 image for LLM vision
    extracted_markdown TEXT,                            -- partial MD from LLM extraction step
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_chunks_job_status_order ON photo_chunks (job_id, status, order_num ASC);
CREATE INDEX IF NOT EXISTS idx_photo_jobs_status_created ON photo_jobs (status, created_at ASC);
