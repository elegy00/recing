# Phase Init: Project Setup (Monorepo Scaffolding)

## Goal
Initialize the monorepo structure, shared tooling config, and package scaffolds that all other phases build on top of.

---

## Step 1 — Root `package.json` + pnpm workspaces

```bash
cd /path/to/recing && pnpm init
```

Create these files at project root:

**`package.json`:**
```json
{ "name": "recing", "private": true, "type": "module",
  "workspaces": ["packages/*"],
  "scripts": { "build": "pnpm -r build", "test": "pnpm -r test", "lint": "pnpm -r lint" },
  "devDependencies": { "@types/node": "^25.9.2", "typescript": "^6.0.3" } }
```

**`pnpm-workspace.yaml`:**
```yaml
packages: ["packages/*"]
```

---

## Step 2 — Shared `tsconfig.base.json` (root)

Extended by every package. Enforces consistent TS settings across the monorepo.

> **Note:** No `allowImportingTsExtensions` — it conflicts with emit. Vite resolves modules for web; schema/ingestion use bundler-style imports without `.ts` extensions in production.

```json
{ "compilerOptions": {
    "target": "es2023", "lib": ["ES2023"], "module": "esnext",
    "moduleResolution": "bundler", "verbatimModuleSyntax": true,
    "moduleDetection": "force", "strict": true, "skipLibCheck": true,
    "noUnusedLocals": true, "noUnusedParameters": true,
    "erasableSyntaxOnly": true, "noFallthroughCasesInSwitch": true,
    "declaration": true, "declarationMap": true, "sourceMap": true } }
```

---

## Step 3 — Create package scaffolds

### `@recing/schema`
```bash
mkdir -p packages/schema/src && echo 'export {};' > packages/schema/src/index.ts
```

**`packages/schema/package.json`:**
```json
{ "name": "@recing/schema", "version": "0.0.0", "type": "module",
  "main": "./src/index.ts", "types": "./dist/index.d.ts",
  "exports": { ".": { "import": "./src/index.ts", "types": "./dist/index.d.ts" } },
  "scripts": { "build": "tsc --project tsconfig.json" } }
```

**`packages/schema/tsconfig.json`:**
```json
{ "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src"] }
```

### `@recing/ingestion`
```bash
mkdir -p packages/ingestion/src && echo 'export {};' > packages/ingestion/src/index.ts
```

**`packages/ingestion/package.json`:**
```json
{ "name": "@recing/ingestion", "version": "0.0.0", "type": "module",
  "bin": { "recing-ingest": "./src/cli.ts" },
  "main": "./src/index.ts", "types": "./dist/index.d.ts",
  "exports": { ".": { "import": "./src/index.ts", "types": "./dist/index.d.ts" } },
  "scripts": { "build": "tsc --project tsconfig.json" },
  "dependencies": { "@recing/schema": "workspace:*" } }
```

**`packages/ingestion/tsconfig.json`:** same structure as schema (extends base, outDir/rootDir).

### `@recing/web` — Vite + React
```bash
mkdir -p packages/web/src/{routes,components,lib}
cd packages/web && npm create vite@latest . -- --template react-ts
# Answer: no to overwrite existing files when prompted
```

Then fix the generated `package.json`:
```json
{ "name": "@recing/web", "version": "0.0.0", "type": "module",
  "scripts": { "dev": "vite", "build": "tsc -b && vite build", "preview": "vite preview" },
  "dependencies": { "react": "^19.2.7", "react-dom": "^19.2.7" },
  "devDependencies": { "@types/react": "^19.2.17", "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.2", "typescript": "^6.0.3", "vite": "^8.0.16" } }
```

**`packages/web/tsconfig.app.json`** — add `"jsx": "react-jsx"` to compilerOptions.

---

## Step 4 — Install runtime deps & verify

```bash
cd packages/schema && pnpm add zod
cd /path/to/recing && pnpm install          # resolve workspace symlinks
pnpm run build                               # all 3 packages compile + web bundles
```

### Validation checklist
- [ ] `pnpm install` — no errors, symlink `@recing/schema` → `packages/schema` in ingestion
- [ ] `pnpm run build` — schema compiles, ingestion compiles, web builds with Vite
- [ ] `tsc --project packages/web/tsconfig.app.json --noEmit` — JSX renders clean

### Resulting structure

```
recing/
├── tsconfig.base.json          # shared TS config (extends from each package)
├── package.json                # root: workspaces, scripts, tooling deps
├── pnpm-workspace.yaml         # workspace definition
└── packages/
    ├── schema/                 # @recing/schema — shared types + Zod validation
    │   └── src/index.ts        # stub; Phase 0 fills this in
    ├── ingestion/              # @recing/ingestion — CLI worker
    │   └── src/index.ts        # stub; Phase 7 fills this in
    └── web/                    # @recing/web — API + UI on fly.io
        ├── src/App.tsx         # minimal React entry
        └── vite.config.ts      # Vite config with React plugin
```

## Dependencies

Tooling: `typescript`, `@types/node` (root devDeps), `zod` (@recing/schema runtime).
These are consumed by later phases — init only provisions scaffolding.
