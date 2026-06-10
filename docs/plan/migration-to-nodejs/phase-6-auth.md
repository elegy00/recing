# Phase 6: Authentication

## Status: ✅ Done

## Implementation

### Middleware (`src/auth.ts`)
```typescript
function authEnabled(): boolean        // true if RECING_API_KEY is set and non-empty
function requireAuth(): MiddlewareHandler // skips check when disabled, validates Bearer token otherwise
```

- **Dev convenience**: When `RECING_API_KEY` is not set, all routes work without authentication
- **Prod behavior**: All `/api/*` endpoints reject requests with 401 if no/invalid Bearer token
- **Public endpoint**: `GET /health` remains accessible (for health checks)

### Route Architecture
```
/app.ts (Hono)
├── publicApp
│   └── GET /health          ← No auth required
└── api (.use("*", requireAuth()))
    ├── POST /api/recipes
    ├── GET  /api/recipes
    ├── PATCH /api/recipes/:id/result
    └── DELETE /api/recipes/:id
```

### Frontend (`src/api.ts`)
- `authenticatedFetch()` wraps all API calls, automatically adds `Authorization: Bearer <key>` header when key is configured
- Key read from `<meta name='recing-api-key'>` tag (server-injected) or `globalThis.__RECING_API_KEY` in dev

### Tests (`tests/auth.test.ts`) — 14 tests
| Category | Tests |
|----------|-------|
| `authEnabled()` | false when unset, true when set, false when empty string |
| Auth disabled mode | POST/GET work without token, /health always works |
| Auth enabled mode | Missing/wrong/empty Bearer → 401; correct token → success; /health still public |

## Verification
```bash
# All tests pass
npx vitest run                          # ✅ 27 passed (13 recipe + 14 auth)
npx tsc --noEmit                        # ✅ clean
```
