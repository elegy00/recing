#!/usr/bin/env bash
#
# Bootstrap & deploy recing to k3s
# Downloads manifests from the GitHub main branch and runs all setup steps.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/elegy00/recing/main/k8s/deploy.sh | bash
#
#   # or download first, then customize:
#   curl -fsSL -o deploy.sh https://raw.githubusercontent.com/elegy00/recing/main/k8s/deploy.sh
#   bash deploy.sh

set -euo pipefail

BRANCH="${DEPLOY_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"
REPO="elegy00/recing"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

log()  { echo -e "\033[1m>>> $*\033[0m"; }
info() { echo -e "\033[36m    $*\033[0m"; }

# ── Download manifests ──────────────────────────────────────────
for f in postgres.yaml web.yaml ingestion.yaml packages/migrate/schema.sql; do
  url="${RAW}/$f"
  log "Downloading $f ..."
  if ! curl -fsSL -o "$TMPDIR/$f" "$url"; then
    echo "ERROR: Failed to fetch $url"
    echo "  (branch '$BRANCH' or path '$f' may not exist)"
    exit 1
  fi
done

# ── Step 1: PostgreSQL ─────────────────────────────────────────
log "1/5 — Deploying PostgreSQL ..."
kubectl apply -f "$TMPDIR/postgres.yaml"
kubectl wait --for=condition=ready pod -l app=recing-postgres --timeout=120s
info "PostgreSQL is ready"

# ── Step 2: Initialize database ─────────────────────────────────
log "2/5 — Initializing database schema ..."
kubectl exec -it deployment/recing-postgres -- \
  psql -U recing -d recing -f /dev/stdin < "$TMPDIR/schema.sql" \
  || kubectl exec deployment/recing-postgres -- \
  psql -U recing -d recing -f /dev/stdin < "$TMPDIR/schema.sql"
info "Schema initialized"

# ── Step 3: Secrets ─────────────────────────────────────────────
log "3/5 — Creating secrets ..."
read -rp "API key (or leave blank for none):" API_KEY
read -rp "LLM endpoint (e.g. http://192.168.178.71:8085/v1/chat/completions):" LLM_ENDPOINT

kubectl create secret generic recing-secrets \
  --from-literal=api-key="${API_KEY:-}" \
  --from-literal=postgres-url="postgresql://recing:recing@recing-postgres:5432/recing" \
  --from-literal=llm-endpoint="${LLM_ENDPOINT}" \
  --dry-run=client -o yaml | kubectl apply -f -
info "Secrets created"

# ── Step 4: Deploy apps ─────────────────────────────────────────
log "4/5 — Deploying recing-web and recing-ingestion ..."
kubectl apply -f "$TMPDIR/web.yaml"
kubectl apply -f "$TMPDIR/ingestion.yaml"
kubectl rollout status deployment/recing-web --timeout=60s
kubectl rollout status deployment/recing-ingestion --timeout=60s
info "Both deployments are rolling out"

# ── Step 5: Summary ─────────────────────────────────────────────
log "5/5 — Done! Verify with:"
echo ""
echo "  kubectl get pods"
echo "  kubectl logs -f deployment/recing-web"
echo "  kubectl logs -f deployment/recing-ingestion"
