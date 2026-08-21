# @recing/pi-track

A minimal [Pi](https://pi.dev) extension that records **per-session performance stats** so you can
understand how the models and prompts you use actually behave.

For every session it writes one markdown report to:

```
<cwd>/pi_track/<sessionId>.md
```

`<cwd>` is the directory Pi was started in. One file per session, rewritten as the session progresses.

## What it captures

| Signal | Source event(s) | Where it shows up |
| --- | --- | --- |
| Prompt / finish timestamps | `agent_start`, `agent_settled` | **Prompts / Runs** (wall-clock duration per prompt) |
| Per-LLM-call token usage + cost | `turn_end` (assistant message `usage`) | **LLM Calls (per turn)** and **Token Usage by Model** |
| Compactions applied | `session_compact` | **Compactions** (reason, tokens before, summary size) |
| Model switches | `model_select` | **Model Changes** |

```
 pi lifecycle                     pi-track state                 report file
 ────────────                     ──────────────                 ───────────
 session_start        ───────►    new SessionTracker      ───►   create <id>.md
 before_agent_start   ───────►    remember prompt
 agent_start          ───────►    run.startTs             ───►   rewrite
 turn_start           ───────►    turn.startTs
 turn_end             ───────►    turn.usage/model/cost   ───►   rewrite
 agent_settled        ───────►    run.finishTs            ───►   rewrite
 session_compact      ───────►    compaction record       ───►   rewrite
 model_select         ───────►    model change record     ───►   rewrite
 session_shutdown     ───────►    final flush             ───►   rewrite
```

## Install / use

From this repository (local path install):

```bash
pi install ./packages/pi-track        # user scope
pi install -l ./packages/pi-track     # project scope (.pi/settings.json)
```

Or try it for a single run without installing:

```bash
pi -e ./packages/pi-track
```

Then just use Pi normally — the report appears/updates in `./pi_track/` of the folder you started Pi from.

### Disable

Set `PI_TRACK=0` in the environment to turn tracking off entirely (no files written).

## Report template

The file shape is stable across sessions (empty sections render as `_(none)_`):

```markdown
# Pi Session Track — <name or sessionId>

## Overview          session id, name, file, cwd, models, start/last-updated, wall time
## Totals            runs, turns, compactions, in/out/cache tokens, total tokens, est. cost
## Prompts / Runs    # | started | finished | duration | prompt
## LLM Calls (per turn)  turn | time | dur | model | in | out | cacheR | cacheW | total | cost | stop | tools | text ch
## Token Usage by Model  model | calls | in | out | cacheR | cacheW | total | cost   (sorted by cost, desc)
## Compactions       # | time | reason | tokens before | summary ch | summarize cost
## Model Changes     time | from | to | source
```

Token counts use thousands separators; costs are USD with 6 decimals; times are UTC.

## Layout

```
packages/pi-track/
├── extensions/index.ts   # pi extension entry: wires events → SessionTracker, writes the file
├── src/
│   ├── track.ts          # dependency-free core: types, SessionTracker, renderStats (the template)
│   ├── track.test.ts     # unit tests for aggregation + rendering
│   └── index.ts          # public re-exports
├── package.json          # declares the pi manifest (pi.extensions → ./extensions)
├── tsconfig.json         # typechecks src + extensions against real pi types (noEmit)
└── vitest.config.ts
```

The core (`src/track.ts`) has **no** `@earendil-works/*` imports, so it is trivially testable and
reusable. The extension entry only maps pi's event payloads onto the core's plain types.

## Development

```bash
pnpm --filter @recing/pi-track test      # run unit tests
pnpm --filter @recing/pi-track build     # typecheck (no emit; pi loads the .ts directly)
```

> `@earendil-works/pi-coding-agent` is a peer dependency (provided by Pi at runtime) and a dev
> dependency here only so the extension entry typechecks against the real API.
