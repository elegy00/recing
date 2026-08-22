# Kubernetes Deployment — LAN Cluster

## Quick deploy

Download and run the bootstrap script — it pulls all manifests from GitHub and walks you through setup:

```bash
curl -fsSL https://raw.githubusercontent.com/elegy00/recing/main/k8s/deploy.sh | bash
```

Or download first to review / customize:

```bash
curl -fsSL -o deploy.sh https://raw.githubusercontent.com/elegy00/recing/main/k8s/deploy.sh
bash deploy.sh
```

The script handles: downloading manifests → deploying PostgreSQL → initializing schema → creating secrets → deploying web + ingestion.

## Architecture

```
Browser ──► Ingress (recing.lan) ──► recing-web:80
                                                       │
recing-ingestion ──► llama-cpp:8085 ──────────────────┘
        ▲                                              │
        │ POST results                                 │
        └──────────────────────────────────────────────┘
                           │
                        ┌──▼───────┐
                        │ postgres │
                        │ :5432    │
                        └──────────┘
```

Prerequisites:
1. **llama-cpp** — external in your LAN (OpenAI-compatible API on :8085)
2. **k3s** with `kubectl` configured

PostgreSQL is deployed as part of the stack.

## Deploy

```bash
# 1. Build & push images
docker build -t <registry>/recing/web:latest        -f k8s/Dockerfile.web .
docker build -t <registry>/recing/ingestion:latest  -f k8s/Dockerfile.ingestion .
docker push <registry>/recing/web:latest
docker push <registry>/recing/ingestion:latest

# 2. Create secrets (Postgres URL + API key)
kubectl create secret generic recing-secrets \
  --from-literal=api-key="your-key" \
  --from-literal=postgres-url="postgresql://user:pass@postgres-host:5432/recing"

# 3. Apply
kubectl apply -f k8s/web.yaml
kubectl apply -f k8s/ingestion.yaml

# 4. Verify
kubectl get pods
kubectl logs -f deployment/recing-web
```

## Ingress

Expose the web app in your LAN:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: recing-ingress
spec:
  rules:
  - host: recing.your.lan
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: recing-web
            port:
              number: 80
```
