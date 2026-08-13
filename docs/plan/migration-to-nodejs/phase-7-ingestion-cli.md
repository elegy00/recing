# Phase 7: Ingestion Service (CLI/Worker)

## Status: ✅ Done

## Architecture

In production, this runs as the `recing-ingestion` k8s Deployment (1 replica):

```
┌───────────────────────────────────────────────────┐
│  k8s Cluster (LAN)                                │
│                                                   │
│  ┌──────────────────────┐  ┌─────────────────┐   │
│  │ Deployment: web      │  │ llama-cpp svc   │   │
│  │                      │  │ (:8085)         │   │
│  │  POST /api/recipes   │  │                 │   │
│  │  GET /recipes?st=P   │──│  fetch + LLM    │   │
│  │  PATCH /:id/result   │  │                 │   │
│  └──────────┬───────────┘  └─────────────────┘   │
│             │                                     │
│  ┌──────────▼───────────┐                        │
│  │ Deployment:          │  Loop:                 │
│  │ ingestion            │  1. GET pending jobs   │
│  │                      │  2. fetchUrl + extract │
│  │  recing-ingest start ├────▶ PATCH /:id/result │
│  │                      │                        │
│  │  3. Sleep INTERVAL   │                        │
│  └──────────────────────┘                        │
└───────────────────────────────────────────────────┘
```

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/worker.ts` | ~120 | Core polling loop, single-job processing, graceful shutdown via AbortController |
| `src/api-client.ts` | ~95 | Web API client with Bearer auth (fetchPendingJobs, submitJob, postResult, reportFailure) |
| `src/cli.ts` | ~140 | CLI entry: `start` (worker loop), `fetch <url>` (single-shot extraction) |
| `src/worker.test.ts` | ~150 | 8 tests covering abort control, empty jobs, poll errors, api-client methods |

## Worker Behavior
- **Single-threaded**: processes one job at a time (matches Java behavior)
- **Sequential processing**: fetch → reduce → LLM → post result for each job
- **Graceful shutdown**: SIGINT/SIGTERM handled via AbortController
- **Error resilience**: poll errors and per-job failures don't crash the loop; errors are reported to web API

## Configuration (env vars)

| Variable | Default | Description |
|---|---|---|
| `WEB_API_URL` | `http://localhost:3000` | URL of deployed web API |
| `API_KEY` | *(required)* | Bearer token for authentication |
| `LLM_ENDPOINT` | `http://localhost:8085/v1/chat/completions` | llama.cpp server endpoint |
| `LLM_MODEL` | `qwen3.6` | Model name sent to llama.cpp |
| `MAX_CONTENT_CHARS` | `60000` | Content size limit before sending to LLM |
| `POLL_INTERVAL_MS` | `5000` | Seconds between job fetch cycles |

## CLI Usage
```bash
# Start the worker loop (runs forever, Ctrl+C to stop)
npx @recing/ingestion start

# Single-shot extraction (for testing/debugging)
npx @recing/ingestion fetch "https://example.com/chocolate-cake"
```

## Tests (`src/worker.test.ts`) — 8 tests
| Test | What it verifies |
|------|-----------------|
| `returns an AbortController` | Loop can be stopped via abort signal |
| `handles empty pending jobs` | No crash when queue is empty |
| `handles poll errors without crashing` | Network failures don't terminate loop |
| `fetchPendingJobs returns recipes` | Correct API call + auth header parsing |
| `fetchPendingJobs throws on non-200` | Error handling for failed requests |
| `submitJob returns jobId string` | Job submission flow |
| `postResult calls API with extraction` | Result posting with auth |
| `reportFailure calls API with error info` | Failure reporting with auth |

## Verification
```bash
# All 150 ingestion tests pass (including 8 new worker tests)
npx vitest run                          # ✅ 150 passed

# TypeScript clean for new files
npx tsc --noEmit -p packages/ingestion/tsconfig.json  # ⚠️ pre-existing errors in old test files only

# All web API tests still pass (auth integration)
cd packages/web && npx vitest run       # ✅ 27 passed
```
