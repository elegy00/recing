# Kubernetes Deployment — LAN Cluster

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

Three things you need running:
1. **postgres** — external in your LAN
2. **llama-cpp** — external in your LAN (OpenAI-compatible API on :8085)
3. **Two k8s Deployments** — `recing-web` + `recing-ingestion`

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
