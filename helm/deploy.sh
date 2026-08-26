#!/usr/bin/env bash
#
# Deploy recing to k3s using Helm.
#
# Usage:
#   bash helm/deploy.sh                  # interactive install/upgrade
#   bash helm/deploy.sh --build          # build & push images first
#   bash helm/deploy.sh --skip-build     # skip build (default)
#
# Environment variables (non-interactive / CI):
#   API_KEY        optional
#   LLM_ENDPOINT   required
#   REGISTRY       image registry prefix  (default: ghcr.io/elegy00/recing)
#   IMAGE_TAG      image tag              (default: latest)
#   NAMESPACE      k8s namespace          (default: default)
#   RELEASE        helm release name      (default: recing)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHART_DIR="$SCRIPT_DIR/recing"

REGISTRY="${REGISTRY:-ghcr.io/elegy00/recing}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
NAMESPACE="${NAMESPACE:-default}"
RELEASE="${RELEASE:-recing}"
BUILD=false

log()  { echo -e "\033[1m>>> $*\033[0m"; }
info() { echo -e "\033[36m    $*\033[0m"; }
err()  { echo -e "\033[31mERROR: $*\033[0m" >&2; exit 1; }

for arg in "$@"; do
  case "$arg" in
    --build)      BUILD=true ;;
    --skip-build) BUILD=false ;;
    *) err "Unknown argument: $arg" ;;
  esac
done

# ── Pre-flight ──────────────────────────────────────────────────
command -v kubectl >/dev/null 2>&1 || err "kubectl not found in PATH"
command -v helm    >/dev/null 2>&1 || err "helm not found in PATH"

# ── Prompt helper ───────────────────────────────────────────────
ask() {  # ask VAR "prompt"
  local var="$1" prompt="$2"
  if [ -r /dev/tty ] && [ -w /dev/tty ]; then
    read -rp "$prompt" "$var" </dev/tty || true
  else
    info "No TTY — using environment variable ${var}"
  fi
}

# ── Step 1: Build & push (optional) ────────────────────────────
if [ "$BUILD" = true ]; then
  log "1/4 — Building and pushing images ..."
  REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

  docker build -t "${REGISTRY}/web:${IMAGE_TAG}"       -f "${REPO_ROOT}/docker/Dockerfile.web"       "$REPO_ROOT"
  docker build -t "${REGISTRY}/ingestion:${IMAGE_TAG}" -f "${REPO_ROOT}/docker/Dockerfile.ingestion"  "$REPO_ROOT"
  docker build -t "${REGISTRY}/migrate:${IMAGE_TAG}"   -f "${REPO_ROOT}/docker/Dockerfile.migrate"    "$REPO_ROOT"

  docker push "${REGISTRY}/web:${IMAGE_TAG}"
  docker push "${REGISTRY}/ingestion:${IMAGE_TAG}"
  docker push "${REGISTRY}/migrate:${IMAGE_TAG}"
  info "Images pushed"
else
  log "1/4 — Skipping build (pass --build to build & push images)"
fi

# ── Step 2: Collect secrets ─────────────────────────────────────
log "2/4 — Collecting secrets ..."

API_KEY="${API_KEY:-}"
LLM_ENDPOINT="${LLM_ENDPOINT:-}"

ask API_KEY      "API key (or leave blank for none): "
ask LLM_ENDPOINT "LLM endpoint (e.g. http://192.168.1.10:8085/v1/chat/completions): "

[ -z "$LLM_ENDPOINT" ] && err "LLM_ENDPOINT is required. Re-run with LLM_ENDPOINT=<url> or enter it when prompted."

info "Secrets collected"

# ── Step 3: Helm upgrade --install ──────────────────────────────
log "3/4 — Running helm upgrade --install ..."

helm upgrade --install "$RELEASE" "$CHART_DIR" \
  --namespace "$NAMESPACE" \
  --create-namespace \
  --set image.registry="$REGISTRY" \
  --set image.tag="$IMAGE_TAG" \
  --set migrate.tag="$IMAGE_TAG" \
  --set secrets.apiKey="$API_KEY" \
  --set secrets.llmEndpoint="$LLM_ENDPOINT" \
  --wait \
  --timeout 5m

info "Helm release '$RELEASE' deployed"

# ── Step 4: Summary ─────────────────────────────────────────────
log "4/4 — Done! Useful commands:"
echo ""
echo "  kubectl get pods -n $NAMESPACE"
echo "  kubectl logs -f deployment/${RELEASE}-web -n $NAMESPACE"
echo "  kubectl logs -f deployment/${RELEASE}-ingestion -n $NAMESPACE"
echo ""
echo "  # Rollback to previous revision:"
echo "  helm rollback $RELEASE -n $NAMESPACE"
echo ""
echo "  # Uninstall:"
echo "  helm uninstall $RELEASE -n $NAMESPACE"
