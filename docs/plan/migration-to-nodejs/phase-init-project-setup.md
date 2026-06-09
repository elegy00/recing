# Phase Init: Project Setup (Monorepo Scaffolding)

## Goal
Initialize the monorepo structure, shared tooling config, and package scaffolds that all other phases build on top of.

---

## Step 1 — Root `package.json` + pnpm workspaces

```bash
cd /path/to/recing
pnpm init
```

**Root `package.json`:**

```json
{
  "name": "recing",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {}
}
```

**`pnpm-workspace.yaml`:**

```yaml
packages:
  - "packages/*"
```

---

## Step 2 — Shared `tsconfig.base.json` (root)

This base config is extended by every package. It enforces consistent TypeScript settings across the monorepo.

**Root `tsconfig.base.json`:**

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "strict": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

---

## Step 3 — Create package scaffolds

### `packages/schema` (`@recing/schema`)

```bash
mkdir -p packages/schema/src
```

**`packages/schema/package.json`:**

```json
{
  "name": "@recing/schema",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

**`packages/schema/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

### `packages/ingestion` (`@recing/ingestion`)

```bash
mkdir -p packages/ingestion/src
```

**`packages/ingestion/package.json`:**

```json
{
  "name": "@recing/ingestion",
  "version": "0.0.0",
  "type": "module",
  "bin": {
    "recing-ingest": "./src/cli.ts"
  },
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@recing/schema": "workspace:*"
  }
}
```

**`packages/ingestion/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

### `packages/web` (`@recing/web`)

```bash
mkdir -p packages/web/src/{routes,components,lib}
npm create vite@latest . -- --template react-ts
# (answer: no to overwrite existing files when prompted)
```

**`packages/web/package.json`:** *(extends the Vite template + adds workspace deps)*

```json
{
  "name": "@recing/web",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {},
  "devDependencies": {}
}
```

---

## Step 4 — Install dependencies

```bash
pnpm install
```

At this point `pnpm install` resolves workspace symlinks for `@recing/schema` → `packages/schema`.

---

## Resulting structure

```
recing/
├── tsconfig.base.json          # shared TS config (extends from each package)
├── package.json                # root: workspaces, scripts
├── pnpm-workspace.yaml         # workspace definition
└── packages/
    ├── schema/                 # @recing/schema — shared types + Zod validation
    │   └── src/index.ts        # empty stub, Phase 0 fills this in
    ├── ingestion/              # @recing/ingestion — CLI worker
    │   └── src/cli.ts          # empty stub, Phase 7 fills this in
    └── web/                    # @recing/web — API + UI on fly.io
        └── vite.config.ts      # Vite config from template
```

---

## Dependencies

None — pure scaffolding.
