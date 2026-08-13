## Store Submissions for Async Processing

### Goal
Decouple URL submission from LLM processing. User submits → job stored →
worker picks it up → result stored. Job page shows loading or final result.

### Architecture

```
Browser ──► recing-web          Postgres
  POST /recipes  ──────► INSERT jobs
    │                      (PENDING)
  GET /recipes/:id ◄────── SELECT jobs
    │
recing-ingestion
  ◄── SELECT PENDING jobs
  ◄── fetchUrl + llama.cpp
  ──► PATCH /recipes/:id/result
```

**Two pods share one Postgres.** The worker never talks to Postgres directly —
it polls the web API for pending jobs and posts results back.

### State machine
`PENDING` → `PROCESSING` → `COMPLETED` | `FAILED`

### Postgres: `jobs` table

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

CREATE INDEX idx_jobs_status_created ON jobs (status, created_at ASC);
```

### Endpoints

| Endpoint | Method | Who calls | What it does |
|----------|--------|-----------|-------------|
| `/recipes` | POST | Browser | Creates PENDING job, redirects to job page |
| `/recipes/:id` | GET | Browser | Returns job page (loading or result) |
| `/api/recipes?status=PENDING` | GET | Worker | Fetches pending jobs |
| `/api/recipes/:id/result` | PATCH | Worker | Posts extraction result |
| `/api/recipes/:id/fail` | PATCH | Worker | Reports failure |

### Worker loop (single-threaded, 1 pod)

```
loop:
  jobs = GET /api/recipes?status=PENDING
  if jobs empty: sleep(5s); continue
  job = jobs[0]
  status = PROCESSING
  result = fetchUrl(job.url) → extractRecipe(result)
  PATCH /api/recipes/:id/result ← result
  (or PATCH /api/recipes/:id/fail ← error)
```

### What is intentionally NOT done
- No job listing API (add later for admin)
- No retry logic (user resubmits manually on failure)
- No automatic cleanup of old jobs
- No SSE/WebSocket (page refresh is enough)
