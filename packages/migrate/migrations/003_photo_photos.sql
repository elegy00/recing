-- ── Photo ingestion v2: photos table + structured JSON output ─────────
-- Replaces photo_chunks.extracted_markdown (TEXT) with extracted_json (JSONB).
-- Adds a dedicated photos table for 1-N image storage per job.

-- Step 1: Rename column and change type
ALTER TABLE photo_chunks RENAME COLUMN extracted_markdown TO extracted_json;
ALTER TABLE photo_chunks ALTER COLUMN extracted_json TYPE JSONB USING NULL;

-- Step 2: Create photos table FIRST (before adding FK to chunks)
CREATE TABLE IF NOT EXISTS photos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          UUID NOT NULL REFERENCES photo_jobs(id) ON DELETE CASCADE,
    order_num       INTEGER NOT NULL,                    -- 0-based index within job
    content_type    TEXT NOT NULL DEFAULT 'image/jpeg',   -- MIME type
    data_uri        TEXT NOT NULL,                       -- base64 image URI (for LLM vision)
    size_bytes      BIGINT NOT NULL DEFAULT 0,           -- original file size in bytes
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photos_job_order ON photos (job_id, order_num ASC);

-- Step 3: Add FK from chunks → photos so worker can fetch the actual image file
DO $$ BEGIN
    ALTER TABLE photo_chunks ADD COLUMN photo_id UUID REFERENCES photos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN END; $$;
CREATE INDEX IF NOT EXISTS idx_photo_chunks_photo_id ON photo_chunks (photo_id);
