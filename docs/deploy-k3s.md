# Deploy to k3s

Images are built and pushed automatically by GitHub Actions on every push to `main`. This guide covers the k3s deployment.

## Prerequisites

- k3s cluster with `kubectl` configured
- llama.cpp accessible within the cluster network (port 8085)
- Postgres accessible within the cluster network (port 5432)

## One-time setup

```bash
# 1. Create the secret
kubectl create secret generic recing-secrets \
  --from-literal=api-key="your-api-key" \
  --from-literal=postgres-url="postgresql://user:pass@host:5432/recing"

# 2. Create the jobs table (from packages/migrate/schema.sql)
kubectl exec -it <postgres-pod> -- psql -U recing -d recing -c "
  CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', result JSONB, error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX idx_jobs_status_created ON jobs (status, created_at ASC);
"

# 3. Apply k8s manifests
kubectl apply -f k8s/web.yaml
kubectl apply -f k8s/ingestion.yaml

# 4. (Optional) Ingress for LAN access
# See k8s/README.md for Ingress YAML
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
# Get image tag (matches what CI would produce)
TAG=$(git describe --tags --always --dirty)

# Build & push
docker build -t ghcr.io/your-org/recing/web:$TAG        -f k8s/Dockerfile.web .
docker build -t ghcr.io/your-org/recing/ingestion:$TAG  -f k8s/Dockerfile.ingestion .
docker push ghcr.io/your-org/recing/web:$TAG
docker push ghcr.io/your-org/recing/ingestion:$TAG

# Update k8s and deploy
sed -i "s|recing/web:latest|recing/web:$TAG|" k8s/web.yaml
sed -i "s|recing/ingestion:latest|recing/ingestion:$TAG|" k8s/ingestion.yaml
kubectl apply -f k8s/web.yaml k8s/ingestion.yaml
```
