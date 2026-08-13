# Phase 4: Web API (Package `web`)

## Goal
Create the REST API layer — a pure data store with no job processing.

## Steps

### Step 5.1 — Project scaffolding
- Create Hono project with TypeScript
- Configure Postgres connection via `node-postgres` (`pg`)
- Set up environment variable management
- k8s deployment via `k8s/web.yaml` (no fly.toml)

### Step 5.2 — Job submission API
- `POST /api/recipes` → create job with status `PENDING`, store URL in Postgres, return `{ jobId }`
- **No polling endpoint needed** — user flow is: submit URL → redirect to job page
- Map to Postgres `jobs` table:
  - `id` (UUID) — primary key
  - `{ status, created_at }` index for the ingestion worker's poll query

### Step 5.3 — No server-side processing
- **The web app does NOT process jobs.** It is purely:
  - A read/write API for the `jobs` table in Postgres
  - A React SPA that displays data from the API
- Job processing (fetch + LLM extraction) happens in the separate `recing-ingestion` k8s pod

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
