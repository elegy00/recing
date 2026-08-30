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
                                                 │ photo_chunks│
                                                 └─────────────┘
```

## Workflow Steps (per photo job)

### Phase 1: CHUNKING — Sequential extraction
Each photo is processed **one at a time**:

1. `PENDING` → pick next chunk with status PENDING
2. Mark chunk as `EXTRACTING`, persist immediately
3. Send image to vision LLM → get partial recipe markdown
4. Save markdown, mark chunk as `EXTRACTED`
5. Update job's `completed_chunks` counter
6. Repeat until all chunks processed

### Phase 2: MERGING — Combine fragments
1. All extracted chunks fetched (in order)
2. Send all markdown to merge LLM → final RecipeExtraction JSON
3. Save result, mark job as `COMPLETED`

### Failure handling
- Individual chunk failure → marked FAILED, other chunks still processed
- Job-level failure (all chunks failed or merge error) → job marked FAILED
- All state persisted at each step — can resume from any point

## Database Schema

```sql
photo_jobs:
  id          UUID PK
  status      PENDING | CHUNKING | MERGING | COMPLETED | FAILED
  total_photos    INTEGER
  completed_chunks INTEGER
  result      JSONB (final RecipeExtraction)
  error       TEXT

photo_chunks:
  id            UUID PK
  job_id        FK → photo_jobs ON DELETE CASCADE
  order_num     INTEGER (processing order, 0-based)
  status        PENDING | EXTRACTING | EXTRACTED | FAILED
  data_uri      TEXT    (base64 image for LLM)
  extracted_markdown TEXT
  error         TEXT
```

## Key Differences from URL Ingestion

| Aspect          | URL Ingestion       | Photo Ingestion       |
|-----------------|--------------------|----------------------|
| Input           | Single URL         | 1-N photos (base64)  |
| Processing      | Fetch → LLM        | Vision LLM per photo |
| Output step     | Direct JSON        | Markdown fragments   |
| Finalization    | N/A                | Merge all markdown   |
| Worker          | `runWorker()`      | `runPhotoWorker()`   |
| DB tables       | `jobs`             | `photo_jobs`, `chunks` |

## Running Both Workers

```bash
# Start both URL and photo workers (CLI handles this)
npm run start:worker

# Or start individually:
node dist/worker.js          # URL-based only
node dist/photo-worker.js    # Photo-based only
```
