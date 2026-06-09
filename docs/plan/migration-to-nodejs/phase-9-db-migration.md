# Phase 9: Database Migration (Local → Atlas)

## Goal
Migrate existing data from local MongoDB to MongoDB Atlas with a safe, repeatable process.

## Steps

### Step — Hybrid migration script (confirmed approach: Option C)
A lightweight script in `packages/migrate/` that:
1. Connects to local MongoDB and counts documents per status
2. Shows summary (`PENDING: 5, COMPLETED: 42, FAILED: 3`)
3. Asks for confirmation
4. Copies all documents to Atlas with a `migratedAt` timestamp field added

### Alternative approaches (not chosen)
| Approach | Pros | Cons |
|---|---|---|
| **A: mongodump/mongorestore** | Fast, no code needed | Manual, not repeatable |
| **B: TypeScript migration script** | Reusable, integrates with tooling | Extra code to maintain |

## Dependencies
Phase 8 (Deployment) — needs MongoDB Atlas cluster to exist.
