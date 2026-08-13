# Recing Monorepo

```
packages/
├── schema/       Shared types + Zod schemas
├── web/          Hono API + React SPA (k8s: web pod)
├── ingestion/    Worker — fetches URLs, calls llama.cpp (k8s: ingestion pod)
└── migrate/      Postgres migration runner (node-pg-migrate)
```

## How to Run Locally

### Prerequisites

- Node.js 22+ (Corepack enabled for pnpm)
- Docker / Docker Compose (for local Postgres)
- [llama.cpp](https://github.com/ggerganov/llama.cpp) serving the
  OpenAI-compatible API on port 8085

### Run Postgres with Docker Compose

```bash
docker compose up -d    # Postgres at localhost:5432 (volume: recing-pg-data)
```

**Useful commands:**

```bash
docker compose logs postgres
docker compose restart postgres
docker compose exec postgres psql -U recing -d recing  # psql shell
docker compose down                                    # stop + remove containers
docker compose down -v                                 # stop + remove volumes
```

### Setup

```bash
pnpm install
```

Copy and configure environment variables:

```bash
cp .env.example .env.local   # optional — defaults listed below
```

| Variable | Default |
|---|---|
| `POSTGRES_URL` | `postgresql://recing:recing@localhost:5432/recing` |
| `DB_NAME` | `recing` |
| `RECING_API_KEY` | *(none — auth disabled when empty)* |
| `PORT` | `3000` |

### Start the Web App

```bash
cd packages/web
pnpm dev          # Vite + Hono on http://localhost:3000
```

Production mode (after build):

```bash
pnpm run build    # builds client (Vite) + server (TSC)
pnpm start        # runs Hono serving API + static files
```

### Run the Ingestion Worker

```bash
cd packages/ingestion

# Start the polling loop
pnpm dev:start

# Or extract a single URL (for testing)
pnpm dev:fetch "https://example.com/my-recipe"
```

### Run All Tests

```bash
pnpm test          # all packages
pnpm -r test       # same, explicit workspace run
```

---

## Kubernetes Deployment

See [../k8s/README.md](../k8s/README.md) for full instructions.

Two k8s Deployments:
- `recing-web` — Hono API + React SPA
- `recing-ingestion` — background worker (polls for PENDING jobs)

Single Postgres instance shared by both pods.
