-- ── Photo ingestion v3: cleanup redundant data_uri column ─────────────
-- Migration 002 added data_uri NOT NULL to photo_chunks.
-- Migration 003 moved image storage to the photos table, making this column
-- redundant. Make it nullable so existing code (which fetches via JOIN) works.

ALTER TABLE photo_chunks ALTER COLUMN data_uri DROP NOT NULL;
