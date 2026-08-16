# Deploy to k3s

Images are built and pushed automatically by GitHub Actions on every push to `main`. This guide covers the k3s deployment.

```
k3s cluster
├── recing-postgres   ── PostgreSQL 16 (persistent, port 5432)
├── recing-web        ── API server (port 3000)
├── recing-ingestion  ── Worker (calls web + LLM)
├── llama.cpp         ── External LLM endpoint (port 8085)
└── ingress/lb        ── LAN access to web service
```

## One-time setup

```bash
# 1. Deploy PostgreSQL
kubectl apply -f k8s/postgres.yaml
kubectl wait --for=condition=ready pod -l app=recing-postgres --timeout=120s

# 2. Initialize the database
kubectl exec -it deployment/recing-postgres -- psql \
  -U recing -d recing -f /dev/stdin < packages/migrate/schema.sql

# 3. Create the secrets
kubectl create secret generic recing-secrets \
  --from-literal=api-key="your-api-key" \
  --from-literal=postgres-url="postgresql://recing:recing@recing-postgres:5432/recing" \
  --from-literal=llm-endpoint="http://192.168.178.71:8085/v1/chat/completions" \
  --dry-run=client -o yaml | kubectl apply -f -

# 4. Deploy app
kubectl apply -f k8s/web.yaml
kubectl apply -f k8s/ingestion.yaml
```

## Verify

```bash
kubectl get pods
kubectl logs -f deployment/recing-web
kubectl logs -f deployment/recing-ingestion
```

## Rollback

```bash
kubectl rollout undo deployment/recing-web
kubectl rollout undo deployment/recing-ingestion
```

## Manual deploy (without CI)

```bash
TAG=$(git describe --tags --always --dirty)

docker build -t ghcr.io/your-org/recing/web:$TAG        -f k8s/Dockerfile.web .
docker build -t ghcr.io/your-org/recing/ingestion:$TAG  -f k8s/Dockerfile.ingestion .
docker push ghcr.io/your-org/recing/web:$TAG
docker push ghcr.io/your-org/recing/ingestion:$TAG

sed -i "s|recing/web:latest|recing/web:$TAG|" k8s/web.yaml
sed -i "s|recing/ingestion:latest|recing/ingestion:$TAG|" k8s/ingestion.yaml
kubectl apply -f k8s/web.yaml k8s/ingestion.yaml
```
