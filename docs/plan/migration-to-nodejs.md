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

## Target State (TypeScript/Node.js on Kubernetes)

```
┌──────────────────────────────────────────────────────────────┐
│  Kubernetes Cluster (LAN)                                    │
│                                                              │
│  ┌──────────────────┐   ┌──────────────┐                    │
│  │ Deployment: web  │   │  llama-cpp   │                    │
│  │ (Hono + React)   │   │  Service     │                    │
│  │                  │   │  (:8085)     │                    │
│  │  ┌────────────┐  │   └──────────────┘                    │
│  │  │ Hono API   │  │                                      │
│  │  │ React SPA  │  │   ┌────────────┐                     │
│  │  └─────┬──────┘  │   │  postgres  │                     │
│  └────────┼─────────┘   │  (external)│                     │
│           │             └────────────┘                     │
│  ┌────────▼─────────┐                                       │
│  │ Deployment:      │   ┌───────────────┐                   │
│  │ ingestion        │──►│  Ingress      │                   │
│  │ (polling loop)   │   │  recing.lan   │                   │
│  └──────────────────┘   └───────────────┘                    │
│                                                              │
│  Both pods share one Postgres instance                       │
│  Ingestion pod: 1 replica (single-threaded)                  │
│  Web pod: 1-2 replicas (stateless)                           │
└──────────────────────────────────────────────────────────────┘
```

## Package Breakdown (Monorepo)

```
recing/                          ← project root (pnpm workspaces)
├── packages/
│   ├── schema/                  # Shared types, validation schemas
│   ├── web/                     # Hono API + React SPA (k8s: web pod)
│   ├── ingestion/               # Worker — fetches URLs, calls llama.cpp (k8s: ingestion pod)
│   └── migrate/                 # Postgres migration runner
├── k8s/                         # Kubernetes manifests + Dockerfiles
│   ├── web.yaml                 # Web deployment + service
│   ├── ingestion.yaml           # Ingestion deployment
│   ├── Dockerfile.web           # Web container image
│   ├── Dockerfile.ingestion     # Worker container image
│   └── README.md                # Deployment guide
└── pnpm-workspace.yaml
```

---

## Progress Tracker

| Phase | Status | Docs |
|-------|--------|------|
| Init. Project Setup | ✅ Done | [details](./migration-to-nodejs/phase-init-project-setup.md) |
| 0. Foundation (schema) | ✅ Done | [details](./migration-to-nodejs/phase-0-schema.md) |
| 1. Content Reducer | ✅ Done | [details](./migration-to-nodejs/phase-1-content-reducer.md) |
| 2. URL Fetcher | ✅ Done | [details](./migration-to-nodejs/phase-2-url-fetcher.md) |
| 3. LLM Client | ✅ Done | [details](./migration-to-nodejs/phase-3-llm-client.md) |
| 4. Web API | ✅ Done | [details](./migration-to-nodejs/phase-4-web-api.md) |
| 5. Frontend | ✅ Done | [details](./migration-to-nodejs/phase-5-frontend.md) |
| 6. Authentication | ✅ Done | [details](./migration-to-nodejs/phase-6-auth.md) |
| 7. Ingestion Service (Worker) | ✅ Done | [details](./migration-to-nodejs/phase-7-ingestion-cli.md) |
| 8. Deployment (k8s + Postgres) | 🔄 Planned | [details](./migration-to-nodejs/phase-8-deployment.md) |
| 9. DB Migration (Mongo → Postgres) | 🔄 Planned | [details](./migration-to-nodejs/phase-9-db-migration.md) |
| 10. Testing & Validation | 🔄 Planned | [details](./migration-to-nodejs/phase-10-testing.md) |

**Status codes:** ⬜ not started · 🟡 in progress · ✅ done · 🔒 blocked · 🔄 planned

---

## Execution Order Summary

```
✅ Init. Project Setup   ← pnpm workspaces + shared TS config
✅ Phase 0: schema       ← Zod schemas for RecipeExtraction/JobSubmission/LlmResult
✅ Phase 1: content-reducer ← Port RecipeContentReducer + 20 tests
✅ Phase 2: url-fetcher    ← URL fetching + SSRF protection + 133 tests
✅ Phase 3: llm-client     ← LLM client + extraction pipeline + retry logic
✅ Phase 4: web/api        ← Hono REST API (POST/GET/PATCH/DELETE) + 13 tests
✅ Phase 5: web/frontend   ← React SPA (SubmitPage + RecipeListPage + Header)
✅ Phase 6: auth           ← Bearer token middleware, 14 auth tests
✅ Phase 7: ingestion/cli  ← Worker loop (start + fetch commands), 8 worker tests

🔄 Phase 8: deploy        ← k8s manifests, Dockerfiles, Postgres setup
🔄 Phase 9: db-migrate    ← MongoDB → Postgres data migration
🔄 Phase 10: test & validate ← Integration testing, k8s deployment validation
```

**Next step:** Phase 8 — deploy to k8s with Postgres.

---

## Changes from Previous Plan

| Item | Old | New |
|------|-----|-----|
| Hosting | fly.io (public cloud) | Kubernetes (LAN cluster) |
| Database | MongoDB Atlas | Postgres (LAN) |
| Worker | Local CLI (outside containers) | k8s Deployment `recing-ingestion` |
| Deployment config | fly.toml, Dockerfile.web | k8s/web.yaml, k8s/ingestion.yaml, Dockerfiles in k8s/ |
