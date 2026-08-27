# Recing Monorepo

```
packages/
├── schema/       Shared types + Zod schemas
├── web/          Hono API + React SPA (docker: web container)
├── ingestion/    Worker — fetches URLs, calls llama.cpp (docker: ingestion container)
└── migrate/      Postgres migration runner
```

## How to Run Locally

### Prerequisites

- Node.js 22+ (Corepack enabled for pnpm)
- Docker / Docker Compose (for local Postgres)
- [llama.cpp](https://github.com/ggerganov/llama.cpp) on port 8085

### Quick Start

```bash
pnpm install
docker compose up -d
pnpm -C packages/migrate migrate:up
cd packages/web && pnpm dev       # http://localhost:3000
cd packages/ingestion && pnpm dev:start
```

### Run All Tests

```bash
pnpm test          # all packages
```

---

## Kubernetes Deployment

See [../docker/README.md](../docker/README.md) for full instructions.
