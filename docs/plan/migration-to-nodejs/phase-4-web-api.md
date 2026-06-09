# Phase 4: Web API (Package `web`)

## Goal
Create the REST API layer — a pure data store with no job processing.

## Steps

### Step 5.1 — Project scaffolding
- Create Express.js or Hono project with TypeScript
- Configure MongoDB connection (native driver or Mongoose)
- Set up environment variable management
- Add fly.io deployment config (`fly.toml`)

### Step 5.2 — Job submission API
- `POST /api/recipes` → create job with status `PENDING`, store URL in MongoDB, return `{ jobId }`
- **No polling endpoint needed** — user flow is: submit URL → redirect to overview immediately
- Map to MongoDB `jobs` collection:
  - `_id` (String UUID) — primary key
  - `status` index for filtering by processing state

### Step 5.3 — No server-side processing
- **The web app does NOT process jobs.** It is purely:
  - A read/write API for the `jobs` collection in MongoDB
  - A React SPA that displays data from the API
- Job processing (fetch + LLM extraction) happens entirely locally via the ingestion CLI worker

### Step 5.4 — Recipe list API
- `GET /api/recipes` → list all completed, valid recipes (paginated)
- Filter: status = COMPLETED && result.isValid() == true
- Return recipe summary (id, name, url, createdAt)

## Other endpoints (defined in Phase 4, used by ingestion worker)
| Endpoint | Purpose | Called By |
|----------|---------|-----------|
| `GET /api/recipes?status=pending` | Fetch pending jobs | Ingestion worker |
| `PATCH /api/recipes/:id/result` | Post LLM extraction result | Ingestion worker |
| `DELETE /api/recipes/:id` | Remove a job (cleanup) | User via UI |

## Dependencies
Phase 0 (`@recing/schema`) — needs type definitions and validation.
