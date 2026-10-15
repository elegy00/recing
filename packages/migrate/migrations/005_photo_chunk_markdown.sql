-- ── Photo ingestion v4: per-photo markdown as intermediate result ─────────────
-- The extraction step now transcribes each photo into plain Markdown (TEXT).
-- In the merge phase, the aggregated markdown is converted to the final
-- RecipeExtraction JSON using the same pipeline as URL ingestion.
-- Previous structured intermediates are discarded; a restarted job overwrites
-- them with fresh markdown (see retryPhotoJob).

ALTER TABLE photo_chunks RENAME COLUMN extracted_json TO extracted_markdown;
ALTER TABLE photo_chunks ALTER COLUMN extracted_markdown TYPE TEXT USING NULL;
