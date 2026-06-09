# Phase 8: Deployment (fly.io + MongoDB Atlas)

## Goal
Deploy the web app to fly.io and set up MongoDB Atlas.

## Steps

### Step 9.1 — fly.io deployment config
```toml
app = "recing"
primary_region = "ord"  # or closest region

[build]
dockerfile = "Dockerfile.web"

[[services]]
protocol = "tcp"
internal_port = 3000

[env]
NODE_ENV = "production"
```

### Step 9.2 — Docker configuration
Single Dockerfile for the web app:
- Node.js 22 Alpine base
- Build step with pnpm/npm workspaces
- Copy only `packages/web` output (not ingestion — runs locally)

### Step 9.3 — MongoDB Atlas setup
- Create free-tier cluster on MongoDB Atlas
- Configure network access (allow fly.io IP ranges)
- Set up connection string for `MONGODB_URI` env var on fly.io
- Existing local data can be exported/imported via `mongodump`/`mongorestore`

## Dependencies
Phase 4 (Web API) — needs the application to be built and tested.
