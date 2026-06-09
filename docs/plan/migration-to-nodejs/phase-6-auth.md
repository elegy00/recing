# Phase 6: Authentication

## Goal
Add API key authentication to protect the web API.

## Steps

### Step 7.1 — Auth approach (confirmed)
**API key via environment variable**

Simplest approach meeting "not publicly available" requirement:
- Set `RECING_API_KEY` env var on fly.io
- All requests require `Authorization: Bearer <key>` header or query param
- No user accounts, no sessions — just one shared secret

Alternatives (deferred to later):
- **Session-based**: cookie auth → more complex, requires login page
- **OAuth provider** (GitHub/Google): overkill for MVP

### Step 7.2 — Auth middleware
```typescript
function requireAuth(req, res, next) {
  const key = req.headers.authorization?.replace('Bearer ', '');
  if (!key || key !== process.env.RECING_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
```

## Dependencies
Phase 4 (Web API) — middleware is applied to all routes.
