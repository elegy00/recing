# Recing Monorepo

```
packages/
├── schema/       Shared types + Zod schemas
├── web/          Hono API + React SPA (fly.io)
├── ingestion/    CLI worker — fetches URLs, calls llama.cpp
└── migrate/      One-time local → Atlas migration script
```

## How to Run Locally

### Prerequisites

- Node.js 22+ (Corepack enabled for pnpm)
- Docker / Docker Compose (for local MongoDB — see below)
- [llama.cpp](https://github.com/ggerganov/llama.cpp) serving the OpenAI-compatible API on port 8085

### Run MongoDB with Docker Compose

The app expects MongoDB at `mongodb://localhost:27017`. Start it from the project root:

```bash
docker compose up -d
```

See [../docker-compose.yml](../docker-compose.yml) for full configuration. Volume `recing-mongo-data` persists data across restarts.

**Useful commands:**

```bash
docker compose logs mongo                         # view startup
docker compose restart mongo                      # restart (preserves data)
docker exec -it recing-mongo mongosh recing       # mongo shell
docker compose down                               # stop + remove containers
docker compose down -v                            # stop, remove containers AND volumes
```

### Setup

### Setup

```bash
cd /Users/chsa/dev/recing
pnpm install
```

Copy and configure environment variables:

```bash
cp .env.example .env.local   # optional — defaults listed below
```

| Variable | Default |
|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017/recing` |
| `DB_NAME` | `recing` |
| `RECING_API_KEY` | *(none — auth disabled when empty)* |
| `PORT` | `3000` |

### Start the Web App

```bash
cd packages/web
pnpm dev          # Vite + Hono on http://localhost:3000
```

In production mode (after build):

```bash
pnpm run build    # builds client (Vite) + server (TSC)
pnpm start        # runs Hono serving API + static files
```

### Run the Ingestion Worker

The worker polls for pending jobs and processes them through llama.cpp:

```bash
cd packages/ingestion

# Start the polling loop
tsx src/cli.ts start

# Or extract a single URL (for testing)
API_KEY=secret tsx src/cli.ts fetch "https://example.com/my-recipe"
```

Required env vars for the worker:

| Variable | Default |
|---|---|
| `API_KEY` | *(required — matches web API key)* |
| `WEB_API_URL` | `http://localhost:3000` |
| `LLM_ENDPOINT` | `http://localhost:8085/v1/chat/completions` |
| `LLM_MODEL` | `qwen3.6` |

### Run All Tests

```bash
pnpm test          # all packages (230+ tests)
pnpm -r test       # same as above, explicit workspace run
```

---

## How to Deploy to the Cloud

### MongoDB Atlas

Create a free-tier cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas):

```bash
export ATLAS_MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/recing?retryWrites=true&w=majority"
```

Migrate existing local data (if any): `ATLAS_MONGODB_URI="$ATLAS_MONGODB_URI" pnpm -r migrate`.

### Deploy to fly.io

```bash
fly apps create recing --org <your-org>
fly secrets set RECING_API_KEY="your-secret-key" MONGODB_URI="$ATLAS_MONGODB_URI"
fly deploy
```

`Dockerfile.web` builds a minimal image serving the Hono API + React SPA on port 3000. Ingestion runs locally.

### Architecture After Deployment

```
  Fly.io App (Hono + React) ──REST──► MongoDB Atlas
          ▲
          │ GET /recipes?status=PENDING
          │ POST /api/recipes/:id/result
          ▼
  Local Worker (llama.cpp :8085)
```

The ingestion worker runs **locally** — polls the fly.io API for pending jobs, processes via local llama.cpp, posts results back.
