# Local Development

Start Postgres, run migrations, then launch the apps.

## Start

```bash
# 1. Dependencies
cd /path/to/recing && pnpm install

# 2. Postgres (one container)
docker compose up -d

# 3. Migrations
cd /path/to/recing && pnpm -C packages/migrate migrate:up

# 4. Web app (new terminal)
cd /path/to/recing && pnpm -C packages/web dev       # http://localhost:3000

# 5. Worker (new terminal)
cd /path/to/recing && pnpm -C packages/ingestion dev:start
```

Stop with `docker compose down` (add `-v` to drop data).

## Prerequisites

| Tool | Why |
|------|-----|
| Node.js 22+ | Runtime |
| pnpm (via corepack) | Monorepo package manager |
| Docker Compose | Runs Postgres |
| llama.cpp on :8085 | LLM extraction |

## Environments

| Env file | Used by | Notes |
|---|---|---|
| `.env.example` | Template | Copy to `.env.local` or set directly |
| `.env` (project root) | ingestion worker | `WEB_API_URL`, `LLM_ENDPOINT`, `API_KEY` |

## Useful commands

```bash
docker compose logs postgres          # view Postgres logs
docker compose exec postgres psql -U recing recing  # psql shell
cd packages/web && pnpm test          # web tests
cd packages/ingestion && pnpm test    # worker tests
pnpm test                             # all tests
```
