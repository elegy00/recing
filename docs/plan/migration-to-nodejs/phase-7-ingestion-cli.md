# Phase 7: Ingestion Service (CLI/Worker)

## Goal
Create the standalone CLI worker that runs locally, fetches URLs, calls llama.cpp, and posts results to the web API.

## Steps

### Step 8.1 — CLI entry point
```bash
npx @recing/ingestion start          # Start the worker loop (runs forever)
npx @recing/ingestion fetch <url>    # Single-shot extraction (for testing/debugging)
```

### Step 8.2 — Worker architecture
```
┌───────────────────────────────┐
│   Local Machine               │
│                               │
│  ┌─────────────────────────┐  │     REST API calls
│  │  Ingestion CLI Worker    ├────▶ fly.io Web API (MongoDB)
│  │                         │  │     POSTs results back
│  │  Loop:                  │  │
│  │  1. GET /api/recipes?   │  │
│  │     status=pending      │  │
│  │  2. For each job:       │  │
│  │     a. Content reduce   │  │     llama.cpp on local port
│  │     b. Call llama.cpp   │  │     ┌──────────────┐
│  │        (local HTTP)     ├─────▶ │ llama.cpp    │
│  │     c. POST result      │  │     │ :8085        │
│  │        to API           │  │     └──────────────┘
│  │  3. Sleep 5s, repeat    │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

Key design decisions:
- **Single-threaded**: only processes one job at a time (matches current Java behavior)
- **No message queue needed**: simple HTTP polling is sufficient for MVP
- **Separate from web app**: runs on any machine with internet + llama.cpp. Does NOT need fly.io.

### Step 8.3 — Configuration

| Variable | Default | Description |
|---|---|---|
| `WEB_API_URL` | *(required)* | URL of deployed web API |
| `API_KEY` | *(required)* | Bearer token for authentication |
| `LLM_ENDPOINT` | `http://localhost:8085/v1/chat/completions` | llama.cpp server endpoint |
| `LLM_MODEL` | `qwen3.6` | Model name sent to llama.cpp |
| `MAX_CONTENT_CHARS` | `60000` | Content size limit before sending to LLM |
| `POLL_INTERVAL_MS` | `5000` | Seconds between job fetch cycles |

## Dependencies
Phase 1–3 (ingestion internals) — worker uses content-reducer, url-fetcher, and llm-client.
Phase 4 (Web API) — needs endpoints to exist.
