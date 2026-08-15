# Recipe Ingestor — Goal

Accepts a recipe URL from the browser, fetches the page, extracts structured
recipe data via a local LLM (llama.cpp), and stores results in Postgres.

```
Browser ──► recing-web (Hono + React, :80)
                        │
                        ├──► Postgres (:5432)  — store jobs & results
                        │
recing-ingestion ◄──────┘
  (polls PENDING jobs)
     │
     ├──► llama-cpp (:8085)  — extract recipe
     │
     └──► recing-web:80      — post result
```

**Key properties:**
- **Deployment**: Kubernetes cluster in the LAN
- **Web pod**: Hono API + React SPA (stateless, 1-2 replicas)
- **Worker pod**: polling loop, single replica (single-threaded to protect llama.cpp)
- **Database**: Postgres — shared by both pods
- **LLM**: llama.cpp — external service in LAN
