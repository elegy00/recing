# Helm Chart — Deployment Plan

## Why Helm over raw manifests

The old `k8s/` directory uses plain YAML + a shell script that splices values together manually.
Helm gives us: typed values, Go templating, atomic upgrade/rollback, and a single `helm upgrade --install` instead of `kubectl apply` per file.

---

## Chart layout

```
helm/
  plan.md              ← this file
  deploy.sh            ← interactive install/upgrade script (replaces k8s/deploy.sh)
  recing/              ← Helm chart root
    Chart.yaml
    .helmignore
    values.yaml        ← all defaults (edit or use --set / -f overrides)
    templates/
      _helpers.tpl     ← shared name/label helpers
      secret.yaml      ← recing-secrets (apiKey, postgresUrl, llmEndpoint)
      postgres.yaml    ← PVC + Deployment + Service  (toggleable via postgres.enabled)
      web.yaml         ← Deployment + Service (with migrate initContainer)
      ingestion.yaml   ← Deployment + Service (with migrate initContainer)
      ingress.yaml     ← Ingress  (toggleable via ingress.enabled)
```

---

## Migration strategy — initContainers

Both `web` and `ingestion` pods carry an initContainer that runs the migrate image before
the main container starts.  The migration tool (packages/migrate) uses sequential, numbered
SQL files and marks each one applied, so running it from two pods simultaneously is safe:
the second run simply finds nothing left to do.

```
Pod start sequence
──────────────────
web pod:
  [initContainer: migrate] ──► runs migrations ──► exits 0
  [container:     web    ] ──► starts

ingestion pod:
  [initContainer: migrate] ──► idempotent run  ──► exits 0
  [container:     ingestion] ──► starts
```

Trade-off: on a brand-new cluster both initContainers race to apply migrations at the same
time.  Because migrations are append-only SQL and the tool applies them inside a transaction,
one will win and the other will find the schema already current — no harm done.

---

## Key values (values.yaml sections)

```
image
  registry    ghcr.io/elegy00/recing
  tag         latest
  pullPolicy  Always

migrate.tag   latest            ← can pin migrate image separately

web
  replicaCount  1
  port          3000
  resources     requests/limits

ingestion
  replicaCount  1
  llmModel      qwen3.6
  maxContentChars 60000
  resources     requests/limits

postgres
  enabled   true                ← set false to use an external DB
  user/password/database/storage

secrets
  apiKey        ""              ← set via --set or a private values file
  llmEndpoint   ""              ← required
  postgresUrl   ""              ← auto-derived when postgres.enabled; override if external

ingress
  enabled  true
  host     recing.lan
  annotations  traefik defaults
```

---

## Deploy workflow

```
1. Build & push images
   bash helm/deploy.sh --build

2. First install (interactive — prompts for secrets)
   bash helm/deploy.sh

3. Upgrade after image change
   bash helm/deploy.sh --skip-build   (or just re-run; it's idempotent)

4. Override values without editing files
   helm upgrade --install recing helm/recing \
     --set secrets.llmEndpoint=http://192.168.1.10:8085/v1/chat/completions \
     --set image.tag=v1.2.3
```

---

## Differences from k8s/

| k8s/                        | helm/                                      |
|-----------------------------|--------------------------------------------|
| Separate migrate Job        | initContainer on web + ingestion           |
| Hard-coded values in YAML   | All values in values.yaml / --set          |
| kubectl apply per file      | Single helm upgrade --install              |
| No rollback                 | helm rollback <release> <revision>         |
