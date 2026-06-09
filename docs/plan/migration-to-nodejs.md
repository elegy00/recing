# Migration Plan: Java/Spring Boot → TypeScript/Node.js

## Current State (Java/Spring Boot)

```
┌─────────────────────────────────────────────┐
│  Spring Boot App (Java 17, Maven)           │
│                                             │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐ │
│  │ Controller│  │ FetchSvc  │  │ LLM Svc  │ │
│  │ Thymeleaf │  │ SSRF      │  │ llama.cpp│ │
│  │ MongoRepo │  │ Redirects │  │ Retry    │ │
│  └──────────┘  └───────────┘  └──────────┘ │
│                                             │
│  Single monolith: web + ingestion combined  │
└──────┬──────────────────────────────────────┘
       │ MongoDB (local)
```

## Target State (TypeScript/Node.js on fly.io)

```
                        ┌───────────────────────┐
                        │  Fly.io App           │
                        │                       │
                        │  Web App              │  ← TypeScript + React SPA
                        │  (pure API + UI)      │     No job processing,
                        │                       │     only reads/writes MongoDB
                        │  ┌─────────────────┐  │
         POST URL       │  │ GET /recipes    │  │
         DELETE /:id     │  │ GET /recipes/:id│  │
            ▲           │  └─────────────────┘  │
            │           │                       │
            │           │   MongoDB Atlas Cloud │
            └───────────┼───────────────────────┘
                        │
         ┌──────────────┘
         │ REST API calls (fetch + post result)
         ▼
┌──────────────────────────┐
│  Local Machine           │
│                          │
│  Ingestion CLI Worker    │  ← TypeScript standalone app
│                          │     Runs in a loop locally:
│  Loop:                   │     1. GET /api/recipes?status=pending
│  ┌────────────────────┐  │     2. Call local llama.cpp (REST)
│  │ fetch pending jobs │  │     3. POST result to API
│  └─────────┬──────────┘  │
│            ▼             │
│  ┌────────────────────┐  │
│  │ llama.cpp server   │  │  ← local process (e.g., qwen3.6)
│  │ :8085              │  │     stays on your machine
│  └────────────────────┘  │
└──────────────────────────┘
```

## Package Breakdown (Monorepo)

```
recing/                          ← project root (pnpm workspaces or npm workspaces)
├── packages/
│   ├── schema/                  # Shared types, validation schemas
│   ├── ingestion/               # Local CLI worker — fetches URLs, calls llama.cpp
│   └── web/                     # Main application — API + UI on fly.io
│
├── docs/plan/migration-to-nodejs.md  ← you are here
└── pnpm-workspace.yaml
```

---

## Progress Tracker

| Phase | Status | Docs |
|-------|--------|------|
| Init. Project Setup | ✅ Done | [details](./migration-to-nodejs/phase-init-project-setup.md) |
| 0. Foundation (schema) | ✅ Done | [details](./migration-to-nodejs/phase-0-schema.md) |
| 1. Content Reducer | ⬜ Not started | [details](./migration-to-nodejs/phase-1-content-reducer.md) |
| 2. URL Fetcher | ⬜ Not started | [details](./migration-to-nodejs/phase-2-url-fetcher.md) |
| 3. LLM Client | ⬜ Not started | [details](./migration-to-nodejs/phase-3-llm-client.md) |
| 4. Web API | ⬜ Not started | [details](./migration-to-nodejs/phase-4-web-api.md) |
| 5. Frontend | ⬜ Not started | [details](./migration-to-nodejs/phase-5-frontend.md) |
| 6. Authentication | ⬜ Not started | [details](./migration-to-nodejs/phase-6-auth.md) |
| 7. Ingestion Service (CLI/Worker) | ⬜ Not started | [details](./migration-to-nodejs/phase-7-ingestion-cli.md) |
| 8. Deployment | ⬜ Not started | [details](./migration-to-nodejs/phase-8-deployment.md) |
| 9. Database Migration | ⬜ Not started | [details](./migration-to-nodejs/phase-9-db-migration.md) |
| 10. Testing & Validation | ⬜ Not started | [details](./migration-to-nodejs/phase-10-testing.md) |

**Status codes:** ⬜ not started · 🟡 in progress · ✅ done · 🔒 blocked

---

## Execution Order Summary

```
✅ Init. Project Setup   ← pnpm workspaces + shared TS config + 3 package scaffolds
✅ Phase 0: schema     ← Zod schemas for RecipeExtraction/JobSubmission/LlmResult, error codes, 53 tests
Phase 1: ingestion/content-reducer   ← Port content reduction logic + tests
Phase 2: ingestion/url-fetcher       ← Port URL fetching + SSRF protection + tests
Phase 3: ingestion/llm-client        ← Port LLM client + extraction pipeline + tests
Phase 4: web/api                    ← Express/Hono REST endpoints (pure data layer)
Phase 5: web/frontend               ← React UI (written from scratch, visual ref only)
Phase 6: auth                       ← API key middleware on all routes
Phase 7: ingestion/cli              ← CLI worker loop (local, calls fly.io API + llama.cpp)
Phase 8: deploy                     ← fly.io config + MongoDB Atlas setup
Phase 9: migrate                    ← Local → Atlas DB migration script (hybrid dry-run)
Phase 10: test & validate           ← Port all Java tests to Vitest, integration testing
```

**Estimated effort**: ~40-60 hours of development (excludes deployment configuration and monitoring).

---

## Questions & Decisions Needed

### Q1–Q5: Confirmed ✓
- **Frontend:** React + Vite. Write from scratch, hi-fi designs as visual reference only.
- **Auth:** API key via Bearer token. Simple middleware on all routes.
- **Job processing:** Entirely local via ingestion CLI worker. Fly.io web app is purely data store + REST API.
- **Real-time updates:** No polling needed. Submit → store → redirect to overview.
- **Monorepo tooling:** pnpm workspaces.

### Q6: Database migration — Hybrid approach (Option C)
One-time script with dry-run preview: connect to local MongoDB, show summary, ask confirmation, copy to Atlas with `migratedAt` timestamp. Lives in `packages/migrate/` as a temporary utility. See [Phase 9](./migration-to-nodejs/phase-9-db-migration.md) for details.
