# Recipe Ingestor

Ingests recipes from URLs using a local LLM (llama.cpp). The project is a
pnpm/TypeScript monorepo — **everything lives under [`packages/`](./packages/)**.

```
recing/
├── packages/
│   ├── schema/       Shared types + Zod schemas
│   ├── web/          Hono API + React SPA (k8s: web pod)
│   ├── ingestion/    Worker — fetches URLs, calls llama.cpp (k8s: ingestion pod)
│   └── migrate/      Postgres migration runner
├── docker-compose.yml    Local dev: Postgres
├── k8s/                  Kubernetes manifests (LAN deployment)
└── fly_deploy.md         Legacy: fly.io deployment
```

## How it works

```
Browser ──► recing-web (API + SPA) ──► Postgres
                              │
recing-ingestion ◄────────────┘
  polls for pending jobs
     │
     ├──► llama-cpp (LAN, :8085)
     └──► POST result to recing-web
```

## Prerequisites

- Node.js 22+ with Corepack/pnpm enabled
- Docker / Docker Compose (for local Postgres)
- [llama.cpp](https://github.com/ggerganov/llama.cpp) on port 8085

## Quick Start (Local Dev)

```bash
pnpm install
docker compose up -d        # Postgres on :5432
cd packages/migrate && pnpm migrate:up
cd packages/web && pnpm dev     # http://localhost:3000
cd packages/ingestion && pnpm dev:start
```

## Build & Deploy (k8s)

```bash
docker build -t <reg>/recing/web:latest        -f k8s/Dockerfile.web .
docker build -t <reg>/recing/ingestion:latest  -f k8s/Dockerfile.ingestion .
docker push <reg>/recing/web:latest
docker push <reg>/recing/ingestion:latest
kubectl create secret generic recing-secrets --from-literal=postgres-url="..." --from-literal=api-key="..."
kubectl apply -f k8s/
```

See [`k8s/README.md`](./k8s/README.md) for full instructions.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `POSTGRES_URL` | `postgresql://recing:recing@localhost:5432/recing` | Postgres connection |
| `RECING_API_KEY` | *(none — auth disabled when empty)* | Bearer token for worker |
| `PORT` | `3000` | Web API port |
| `WEB_API_URL` | `http://localhost:3000` | Worker → web API URL |
| `LLM_ENDPOINT` | `http://localhost:8085/v1/chat/completions` | llama.cpp endpoint |
| `POLL_INTERVAL_MS` | `5000` | Worker poll interval |

## Tests

```bash
pnpm test          # all packages
```
