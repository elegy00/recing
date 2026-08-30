# Photo-Based Recipe Ingestion

## Overview

A separate workflow from URL-based ingestion that processes 1-N photos of recipes through the LLM vision model.

```
┌──────────────┐    ┌─────────────────────┐    ┌──────────────────────┐
│   Frontend   │    │ Server Functions     │    │ Photo Worker         │
│              │    │                      │    │                      │
│ PhotoUpload  │───▶│ submitPhotoJob()     │───▶│ runPhotoWorker()     │
│ (1-N photos) │◀───│ getPhotoStatus()     │◀───│ processChunks()      │
└──────────────┘    └─────────────────────┘    └──────────────────────┘
                                                        │
                                                 ┌──────▼──────┐
                                                 │  Postgres   │
                                                 │             │
                                                 │ photo_jobs  │
                                                 │ photos      │ ← image files
                                                 │ chunks      │ ← processing state + results
                                                 └─────────────┘
```

## Workflow Steps (per photo job)

### Phase 1: CHUNKING — Structured extraction per photo
Each photo is processed **one at a time**:

1. `PENDING` → pick next chunk with status PENDING
2. Mark chunk as `EXTRACTING`, persist immediately
3. Fetch image data_uri from `photos` table (via FK)
4. Send to vision LLM → get structured RecipeExtraction JSON
5. Save extraction, mark chunk as `EXTRACTED`
6. Update job's `completed_chunks` counter (+1 per success)
7. Retry up to 2 times on failure before marking FAILED

### Phase 2: MERGING — Combine extractions
1. All extracted chunks fetched (in order)
2. Send all RecipeExtraction objects to merge LLM → final RecipeExtraction JSON
3. Save result, mark job as `COMPLETED`
4. Retry up to 2 times on failure

### Failure handling
- Individual chunk failure → marked FAILED, other chunks still processed
- Job-level failure (all chunks failed or merge error) → job marked FAILED
- All state persisted at each step — can resume from any point

## Database Schema

```sql
photo_jobs:
  id              UUID PK
  status          PENDING | CHUNKING | MERGING | COMPLETED | FAILED
  total_photos    INTEGER
  completed_chunks INTEGER
  result          JSONB (final RecipeExtraction)
  error           TEXT

photos:                    -- NEW: dedicated image storage
  id              UUID PK
  job_id          FK → photo_jobs ON DELETE CASCADE
  order_num       INTEGER (0-based index within job)
  content_type    TEXT (MIME type)
  data_uri        TEXT (base64 image for LLM vision)
  size_bytes      BIGINT

photo_chunks:              -- processing state + results
  id                UUID PK
  job_id            FK → photo_jobs ON DELETE CASCADE
  order_num         INTEGER
  photo_id          FK → photos(id) ON DELETE CASCADE
  status            PENDING | EXTRACTING | EXTRACTED | FAILED
  extracted_json    JSONB (structured RecipeExtraction per photo)
  error             TEXT
```

## Key Differences from URL Ingestion

| Aspect          | URL Ingestion       | Photo Ingestion         |
|-----------------|--------------------|------------------------|
| Input           | Single URL         | 1-N photos (base64)    |
| Processing      | Fetch → LLM        | Vision LLM per photo   |
| Output step     | Direct JSON        | Structured JSON per photo, then merge |
| Finalization    | N/A                | Merge all extractions  |
| Retry           | 2 attempts         | 2 attempts (both steps)|
| Worker          | `runWorker()`      | `runPhotoWorker()`     |
| DB tables       | `jobs`             | `photo_jobs`, `photos`, `chunks` |

## Running Both Workers

```bash
# Start both URL and photo workers (CLI handles this)
npm run start:worker

# Or start individually:
node dist/worker.js          # URL-based only
node dist/photo-worker.js    # Photo-based only
```
