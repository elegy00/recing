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
- [MongoDB](https://www.mongodb.com/docs/manual/installation/) running locally on `mongodb://localhost:27017`
- [llama.cpp](https://github.com/ggerganov/llama.cpp) serving the OpenAI-compatible API on port 8085

### Setup

```bash
cd /Users/chsa/dev/recing
pnpm install
```

Copy and configure environment variables:

```bash
cp .env.example .env.local   # optional — all values have sensible defaults
```

| Variable | Purpose | Default |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/recing` |
| `DB_NAME` | Database name | `recing` |
| `RECING_API_KEY` | Bearer token for API auth (leave empty to disable) | *(none)* |
| `PORT` | HTTP server port | `3000` |

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

| Variable | Purpose | Default |
|---|---|---|
| `API_KEY` | Bearer token matching the web API's key | *(required)* |
| `WEB_API_URL` | Web app base URL | `http://localhost:3000` |
| `LLM_ENDPOINT` | llama.cpp OpenAI-compatible endpoint | `http://localhost:8085/v1/chat/completions` |
| `LLM_MODEL` | Model name | `qwen3.6` |

### Run All Tests

```bash
pnpm test          # all packages (230+ tests)
pnpm -r test       # same as above, explicit workspace run
```

---

## How to Deploy to the Cloud

### 1. MongoDB Atlas

Create a free-tier cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas), then get your connection string:

```bash
export ATLAS_MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/recing?retryWrites=true&w=majority"
```

### 2. Migrate Existing Data (if any)

If you have data in a local MongoDB and want to move it to Atlas, run the migration script:

```bash
ATLAS_MONGODB_URI="mongodb+srv://..." pnpm -r migrate --dry-run   # preview first
ATLAS_MONGODB_URI="mongodb+srv://..." pnpm -r migrate              # confirm & copy
```

This copies all `jobs` documents with a `migratedAt` timestamp.

### 3. Deploy to fly.io

```bash
# Create the app (if not already created)
fly apps create recing --org <your-org>

# Set environment variables on fly.io
fly secrets set RECING_API_KEY="your-secret-key"
fly secrets set MONGODB_URI="$ATLAS_MONGODB_URI"
fly secrets set DB_NAME=recing

# Deploy
fly deploy
```

`Dockerfile.web` builds a minimal image serving the Hono API + React SPA on port 3000. Ingestion runs separately (see below).

### Architecture After Deployment

```
  Fly.io App (Hono + React) ──REST──► MongoDB Atlas
          ▲
          │ GET /recipes?status=PENDING
          │ POST /api/recipes/:id/result
          ▼
  Local Worker (llama.cpp :8085)
```

The ingestion worker runs **locally** — polls the fly.io API for pending jobs, processes them via your local llama.cpp instance, and posts results back. No cloud resources needed for job processing.
