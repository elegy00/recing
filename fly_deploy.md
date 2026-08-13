# Fly.io Deployment Guide — LEGACY

> **Deprecated**: This project now targets Kubernetes (LAN) deployment.
> Kept for historical reference only.

## Architecture Fit ✓

```
Fly.io ──────────────────────────────────────── Vercel (serverless)
│                                              │
│ ✓ Persistent Node.js process               │ ✗ No persistent processes
│ ✓ MongoDB connection pooling               │ ✗ Cold starts kill connections
│ ✓ @hono/node-server compatible             │ ✗ Requires server.listen()
│ ✓ Long-running workers supported           │ ✗ 10s function timeout
└──────────────────────────────────────────────┘
```

## One-Time Setup (You)

### 1. Install Fly CLI
```bash
brew install fly          # macOS
# or: https://fly.io/docs/hands-on/install-flyctl/
```

### 2. Login & Create App
```bash
fly auth login            # opens browser for OAuth
fly apps create recing    # creates app on Fly.io (name must be unique)
```

### 3. Set Environment Secrets
```bash
# Required by the web API (from .env.example)
fly secrets set MONGODB_URI="mongodb+srv://..." \
              DB_NAME=recing \
              RECING_API_KEY="your-secret-api-key"
```

> **Tip**: Never commit `.env` to git. Use `fly secrets list` to verify what's set.

### 4. Initial Deploy
```bash
fly deploy --region ord   # deploys from Dockerfile.web (multi-stage build)
```

## Automated Deployment (Already Configured)

A GitHub Actions workflow is included at `.github/workflows/deploy.yml`:

- **Triggers**: push to `main` or manual dispatch (`workflow_dispatch`)
- **Mechanism**: uses `superfly/flyctl-actions/setup-flyctl@master` → `fly deploy --remote-only`
- **No local build needed** — Docker image built on Fly's infrastructure

### Required GitHub Secret

Add `FLY_API_TOKEN` to your repo settings:
1. Get token: `fly auth token` (copy the value)
2. Go to: **GitHub → Repo → Settings → Secrets and variables → Actions → New repository secret**
3. Name: `FLY_API_TOKEN`, Value: `<the-token>`

After this, every push to `main` automatically deploys to Fly.io.

## Local Development vs Production

| Mode | Command | Ports | Notes |
|------|---------|-------|-------|
| Dev | `cd packages/web && pnpm dev` | 3000 (Hono), 5173 (Vite) | Vite HMR, proxy to Hono |
| Prod (local) | `cd packages/web && pnpm build:client && pnpm build:server && pnpm start` | 3000 | Single Node process |
| Prod (Fly.io) | `fly deploy` | 3000 (mapped externally) | Docker multi-stage build |

## Useful Commands

```bash
# Deploy (manual, after pushing to a branch other than main)
fly deploy

# Check deployment status & logs
fly status
fly logs --tail           # live tail of all instances

# Scale / review config
fly scale show            # current VM size (256MB shared on free tier)
fly ips allocate-v4       # get a dedicated IPv4 address (~$1/month, optional)

# Rollback to previous deployment
fly rollback <deploy-id>  # find id with: fly deploy list --limit 5

# View environment variables
fly secrets list          # names only (not values)
```

## Free Tier Limits

| Resource | Limit | Your Usage |
|----------|-------|------------|
| VMs | 3 small shared VMs | 1 × 256MB / 0.5 CPU / 1GB disk |
| Bandwidth | 160 GB/month egress | TBD (lightweight API) |
| Storage | 10 GB block storage | Not used (MongoDB is external) |

Your app comfortably fits within the free tier. No billing surprises expected.

## Monitoring & Health

The `/health` endpoint pings MongoDB and returns `200 OK` or `503`:

```bash
curl https://recing.fly.dev/health
# {"status":"ok"}  ← healthy
# {"status":"error","message":"MongoDB unreachable"} ← check MONGODB_URI
```

Fly also provides automatic health checks on port 3000 — no extra config needed since your app listens there.
