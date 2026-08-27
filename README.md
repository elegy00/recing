# Recipe Ingestor

Ingests recipes from URLs using a local LLM (llama.cpp). A pnpm/TypeScript monorepo — everything under [`packages/`](./packages/).

```
recing/
├── packages/
│   ├── schema/       Shared types + Zod schemas
│   ├── web/          Hono API + React SPA
│   ├── ingestion/    Worker — fetches URLs, calls llama.cpp
│   └── migrate/      Postgres migrations
├── docker-compose.yml    Local Postgres
├── docker/               Dockerfiles + k3s deployment manifests
├── .github/workflows/    CI/CD (build, test, publish images)
└── docs/
    └── dev-local.md      Local development guide
```

## How it works

```
Browser ──► recing-web (API + SPA) ──► Postgres
                              │
recing-ingestion ◄────────────┘
     │
     ├──► llama-cpp (LAN, :8085)
     └──► POST result to recing-web
```

## Quick start

```bash
pnpm install
docker compose up -d
pnpm -C packages/migrate migrate:up
pnpm -C packages/web dev                   # http://localhost:3000
pnpm -C packages/ingestion dev:start       # worker loop
```

See [`docs/dev-local.md`](./docs/dev-local.md) for details.

## Build & deploy to k3s

```bash
# Option A: manually
pnpm install && cd packages/web && pnpm build && pnpm start  # local prod

# Option B: CI auto-builds images → GHCR → k3s
```

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `POSTGRES_URL` | `postgresql://recing:recing@localhost:5432/recing` | Postgres connection |
| `RECING_API_KEY` | *(none — auth disabled when empty)* | Bearer token for worker |
| `PORT` | `3000` | Web API port |

## Tests

```bash
pnpm test          # all packages
```
