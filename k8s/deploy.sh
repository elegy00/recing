#!/usr/bin/env bash
#
# Bootstrap & deploy recing to k3s
# Uses local repo files if running inside the repo, otherwise fetches from GitHub.
#
# Usage:
#   # Inside the repo:
#   bash k8s/deploy.sh
#
#   # Or via curl (downloads from GitHub):
#   curl -fsSL https://raw.githubusercontent.com/elegy00/recing/main/k8s/deploy.sh | bash
#
# Set BRANCH=main to override the GitHub branch used for fetching.

set -euo pipefail

REPO="elegy00/recing"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH:-main}"

log()  { echo -e "\033[1m>>> $*\033[0m"; }
info() { echo -e "\033[36m    $*\033[0m"; }

# ── Locate source files ─────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA_FILE="$REPO_ROOT/packages/migrate/schema.sql"

if [ -f "$SCRIPT_DIR/postgres.yaml" ] && [ -f "$SCHEMA_FILE" ]; then
  SOURCES="$SCRIPT_DIR"
  SCHEMA="$SCHEMA_FILE"
  log "Using local repo files"
else
  TMPDIR="$(mktemp -d)"
  trap 'rm -rf "$TMPDIR"' EXIT
  SOURCES="$TMPDIR"
  log "Fetching manifests from GitHub (branch '${BRANCH:-main}')"
  for f in postgres.yaml web.yaml ingestion.yaml; do
    url="${RAW}/k8s/$f"
    log "  $f ..."
    if ! curl -fsSL -o "$SOURCES/$f" "$url"; then
      echo "ERROR: Failed to fetch $url"
      exit 1
    fi
  done
  url="${RAW}/packages/migrate/schema.sql"
  log "  schema.sql ..."
  if ! curl -fsSL -o "$SOURCES/schema.sql" "$url"; then
    echo "ERROR: Failed to fetch $url"
    exit 1
  fi
  SCHEMA="$SOURCES/schema.sql"
fi

# ── Step 1: PostgreSQL ─────────────────────────────────────────
log "1/5 — Deploying PostgreSQL ..."
kubectl apply -f "$SOURCES/postgres.yaml"
kubectl wait --for=condition=ready pod -l app=recing-postgres --timeout=120s
info "PostgreSQL is ready"

# ── Step 2: Initialize database ─────────────────────────────────
log "2/5 — Initializing database schema ..."
if kubectl exec deployment/recing-postgres -- psql -U recing -d recing -f /dev/stdin < "$SCHEMA" 2>/dev/null; then
  info "Schema initialized"
else
  info "Retrying without -it ..."
  kubectl exec deployment/recing-postgres -- psql -U recing -d recing -f /dev/stdin < "$SCHEMA"
  info "Schema initialized"
fi

# ── Step 3: Secrets ─────────────────────────────────────────────
log "3/5 — Creating secrets ..."

# Prompt on /dev/tty (the controlling terminal), not stdin: with
# `curl ... | bash` stdin is the pipe carrying this script, so a
# plain `read` would swallow the rest of the script.
# Without a TTY (CI, cron, ...) the environment variables are used.
ask() { # ask VAR "prompt" — value comes from $VAR unless entered
  local var="$1" prompt="$2"
  if [ -r /dev/tty ] && [ -w /dev/tty ]; then
    read -rp "$prompt" "$var" </dev/tty || true
  else
    info "No TTY — using environment variable ${var}"
  fi
}

API_KEY="${API_KEY:-}"
LLM_ENDPOINT="${LLM_ENDPOINT:-}"
ask API_KEY "API key (or leave blank for none):"
ask LLM_ENDPOINT "LLM endpoint (e.g. http://192.168.178.71:8085/v1/chat/completions):"

if [ -z "$LLM_ENDPOINT" ]; then
  echo "ERROR: LLM endpoint is required."
  echo "       Re-run with a value, e.g."
  echo "       LLM_ENDPOINT=http://<host>:8085/v1/chat/completions curl -fsSL ${RAW}/k8s/deploy.sh | bash"
  exit 1
fi

kubectl create secret generic recing-secrets \
  --from-literal=api-key="${API_KEY:-}" \
  --from-literal=postgres-url="postgresql://recing:recing@recing-postgres:5432/recing" \
  --from-literal=llm-endpoint="${LLM_ENDPOINT}" \
  --dry-run=client -o yaml | kubectl apply -f -
info "Secrets created"

# ── Step 4: Deploy apps ─────────────────────────────────────────
log "4/5 — Deploying recing-web and recing-ingestion ..."
kubectl apply -f "$SOURCES/web.yaml"
kubectl apply -f "$SOURCES/ingestion.yaml"
kubectl rollout status deployment/recing-web --timeout=60s
kubectl rollout status deployment/recing-ingestion --timeout=60s
info "Both deployments are rolling out"

# ── Step 5: Summary ─────────────────────────────────────────────
log "5/5 — Done! Verify with:"
echo ""
echo "  kubectl get pods"
echo "  kubectl logs -f deployment/recing-web"
echo "  kubectl logs -f deployment/recing-ingestion"
