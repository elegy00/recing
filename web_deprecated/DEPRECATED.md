# Deprecated — Java/Spring Boot prototype

This folder is the **original Spring Boot (Java/Maven) prototype** and is no
longer used or built. It is kept only for historical reference.

The project now lives entirely under [`../packages/`](../packages/):

- `packages/web` — Hono API + React SPA (replaces this Spring Boot app)
- `packages/ingestion` — CLI worker (URL fetch + llama.cpp extraction)
- `packages/schema` — shared types and Zod schemas
- `packages/migrate` — one-off local → Atlas migration

Nothing in the build (`Dockerfile.web`, `fly.toml`, `pnpm-workspace.yaml`)
references this folder. It can be removed once no longer needed.
