# Recipe Ingestor

Ingests recipes from URLs using a local LLM (llama.cpp). The project is a
pnpm/TypeScript monorepo — **everything lives under [`packages/`](./packages/)**.
(The original Java/Spring Boot prototype now sits unused in
[`web_deprecated/`](./web_deprecated/).)

```
recing/
├── packages/
│   ├── schema/       Shared types + Zod schemas
│   ├── web/          Hono API + React SPA (the server you run + deploy)
│   ├── ingestion/    CLI worker — fetches URLs, calls llama.cpp
│   └── migrate/      One-off local → Atlas migration script
├── docker-compose.yml   Local MongoDB
├── Dockerfile.web       Image for packages/web (fly.io)
└── fly.toml             Deploy config
```

## Prerequisites

- Node.js 22+ with Corepack/pnpm enabled
- Docker / Docker Compose (for local MongoDB)
- [llama.cpp](https://github.com/ggerganov/llama.cpp) serving the
  OpenAI-compatible API on port 8085

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start MongoDB

```bash
docker compose up -d        # MongoDB on localhost:27017 (volume: recing-mongo-data)
```

Stop it later with `docker compose down` (or `down -v` to also drop the volume).

### 3. Start llama.cpp

```bash
./llama-server --model <path-to-model.gguf> --port 8085
```

### 4. Run the web app (API + SPA)

```bash
cd packages/web
pnpm dev                    # Vite + Hono on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) and submit a recipe URL.
The submission is stored as a PENDING job for the worker to process.

### 5. Run the ingestion worker

The worker polls the web API for pending jobs and processes them via llama.cpp.

```bash
cd packages/ingestion

# Start the polling loop
API_KEY=secret pnpm exec tsx src/cli.ts start

# Or run a single-shot extraction (for testing/debugging)
API_KEY=secret pnpm exec tsx src/cli.ts fetch "https://example.com/my-recipe"
```

Worker environment variables:

| Variable | Default | Notes |
|---|---|---|
| `API_KEY` | *(required)* | Bearer token — must match the web API key |
| `WEB_API_URL` | `http://localhost:3000` | Web API base URL |
| `LLM_ENDPOINT` | `http://localhost:8085/v1/chat/completions` | llama.cpp endpoint |
| `LLM_MODEL` | `qwen3.6` | Model name |
| `MAX_CONTENT_CHARS` | `60000` | Max page content sent to the LLM |
| `POLL_INTERVAL_MS` | `5000` | Delay between polls |

> If `RECING_API_KEY` is unset on the web side, auth is disabled and any
> `API_KEY` value is accepted.

## Configuration

Copy and adjust environment variables for the web app:

```bash
cp .env.example .env.local
```

| Variable | Default |
|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017/recing` |
| `DB_NAME` | `recing` |
| `RECING_API_KEY` | *(none — auth disabled when empty)* |
| `PORT` | `3000` |

## Tests

```bash
pnpm test          # run every package's test suite
pnpm -r test       # same, explicit workspace run
```

## Build & Deploy

```bash
# Local production build of the web app
cd packages/web
pnpm run build     # Vite client + TSC server
pnpm start         # Hono serving API + static files on :3000
```

Deploy `packages/web` to fly.io (image built by `Dockerfile.web`):

```bash
fly apps create recing --org <your-org>
fly secrets set RECING_API_KEY="your-secret-key" MONGODB_URI="$ATLAS_MONGODB_URI"
fly deploy
```

The ingestion worker runs **locally** — it polls the deployed API for pending
jobs, runs them through local llama.cpp, and posts results back:

```
  Fly.io App (Hono + React) ──REST──► MongoDB Atlas
          ▲
          │  GET  /recipes?status=PENDING
          │  POST /api/recipes/:id/result
          ▼
  Local Worker (llama.cpp :8085)
```

See [`packages/README.md`](./packages/README.md) for deeper monorepo and
deployment details.
