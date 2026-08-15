# Phase 8: Deployment (Kubernetes + Postgres)

## Goal
Deploy web + ingestion as k8s pods. One secret: Postgres URL + API key.

## Architecture

```
Browser ──► Ingress → recing-web:80 → Postgres
                                   ↕
recing-ingestion ──► llama-cpp:8085 ──► recing-web:80
```

## Steps

### Step 8.1 — Postgres
External in LAN. No k8s manifest needed. Just create the `jobs` table.

### Step 8.2 — Dockerfiles

Two minimal Alpine images:
- `k8s/Dockerfile.web` — build Hono + React, CMD: `node dist/index.js`
- `k8s/Dockerfile.ingestion` — build worker, CMD: `node dist/cli.js start`

### Step 8.3 — k8s manifests

Two files, two Deployments, one Service:
- `k8s/web.yaml` — Deployment (1 replica) + Service (port 80→3000)
- `k8s/ingestion.yaml` — Deployment (1 replica, no Service)

### Step 8.4 — Ingress

Optional NGINX/Traefik Ingress to expose `recing.lan`.

### Step 8.5 — Deploy

```bash
docker build -t <reg>/recing/web:latest        -f k8s/Dockerfile.web .
docker build -t <reg>/recing/ingestion:latest  -f k8s/Dockerfile.ingestion .
kubectl create secret generic recing-secrets \
  --from-literal=api-key="..." \
  --from-literal=postgres-url="postgresql://..."
kubectl apply -f k8s/web.yaml k8s/ingestion.yaml
```

## Dependencies
Phase 7 (Ingestion Worker) — needs both pods built and tested.
