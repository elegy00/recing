# Qwen3.8-27B: mid-session thinking-level control (llama.cpp server + pi)

Documentation and config for switching Qwen3.8-27B's reasoning effort
(**xhigh / medium / low**) between turns in pi, served by a llama.cpp
router (`llama.home.thoster.net`), without reloading the model.

Setup date: 2026-08-17.

## TL;DR

- The level is sent **per request** in `chat_template_kwargs`
  (`enable_thinking`, `reasoning_effort`, `preserve_thinking`).
  No server restart / model reload needed; the change applies on the
  next turn.
- pi's built-in `llama.cpp` provider registers models as
  `reasoning: false` and does **not** forward thinking parameters
  (see earendil-works/pi issue [#5917](https://github.com/earendil-works/pi/issues/5917),
  closed `not_planned`). The fix is a `modelOverrides` entry in
  `~/.pi/agent/models.json` (see `config/models.json`).
- Qwen3.8's effort mechanism is **instruction-based**: the chat template
  injects a system-message instruction per level. It is soft (the model
  complies), not a hard token budget.

## Findings

### 1. Server side (llama.cpp)

- Per-request control points (no reload): `chat_template_kwargs` (all
  builds), top-level `reasoning_effort` / `reasoning: {effort}` (newer
  builds, OpenRouter-compatible). Server-level `--reasoning`,
  `--reasoning-effort`, `--reasoning-budget` are startup flags only.
- The router exposes loaded models; the Qwen3.8-27B GGUF
  (`unsloth/Qwen3.8-27B-GGUF:Q8_0`, also registered as
  `Qwen3.8-27B-high` / `Qwen3.8-27B-low`) is loaded there.
- `--jinja` is required for per-request template kwargs to work.

### 2. The model's chat template (extracted from the GGUF header)

Extracted the `tokenizer.chat_template` (9,993 chars) directly from the
GGUF header of `Qwen3.8-27B-Q8_0.gguf` via a 15 MB HTTP range request —
saved in `templates/qwen3.8-27b-gguf-chat-template.jinja`.

It is an **unsloth-patched** template (comment: *"Unsloth fixes -
developer role, merged system messages, tool calling"*). Key logic:

```jinja
{%- if enable_thinking is undefined or enable_thinking is true %}
    {%- set resolved_reasoning_effort = reasoning_effort|default('xhigh') %}
    {%- if resolved_reasoning_effort == 'high' %}
        {%- set resolved_reasoning_effort = 'xhigh' %}   {# unsloth patch #}
    {%- endif %}
    {%- if resolved_reasoning_effort not in ('xhigh', 'medium', 'low') %}
        {{- raise_exception('Unexpected reasoning effort ' ~ reasoning_effort
            ~ '. Supported types are xhigh (default), medium, and low.') }}
    {%- endif %}
    ...
```

Valid `reasoning_effort` values:

| value    | behavior                                                                 |
|----------|--------------------------------------------------------------------------|
| `xhigh`  | **default**; system message: *"think carefully... prioritize correctness, consistency, and clarity"* |
| `high`   | **silently mapped to `xhigh`** (unsloth patch; the raw HF template would raise) |
| `medium` | baseline; **no explicit instruction** injected                           |
| `low`    | system message: *"Keep your thinking brief and focused..."*              |

`enable_thinking: false` renders an empty `think` block and the model
answers without reasoning. `preserve_thinking: true` keeps earlier
thinking blocks verbatim in history, which makes mid-conversation level
switches safe.

### 3. Client side (pi)

- pi source: `@earendil-works/pi-ai/dist/api/openai-completions.js`.
  With `compat.thinkingFormat: "chat-template"`, pi puts
  `compat.chatTemplateKwargs` into the request's `chat_template_kwargs`
  and resolves `{"$var": "thinking.effort"}` to the value from
  `thinkingLevelMap[<current level>]`.
- `thinkingLevelMap` values: a string is used as-is; `null` hides that
  pi level from the picker.
- The built-in llama.cpp provider (registered by pi's `extensions/llama`
  extension, `dist/extensions/llama/provider.js`) only lists **loaded**
  router models, with `reasoning: false` and
  `compat.supportsReasoningEffort: false` — i.e. it never sends thinking
  params on its own.
- `modelOverrides` in `models.json` is the topmost user-config layer and
  is applied to extension-registered models too
  (`dist/core/provider-composer.js` → `applyModelOverride`). It merges
  `reasoning`, `thinkingLevelMap`, and `compat` over the live model.
  (A `models` array on that provider would instead *replace* the
  dynamic catalog — avoid.)
- `models.json` is re-read whenever `/model` is opened; no restart needed.

## Configuration

Live config: `~/.pi/agent/models.json` (copy in `config/models.json`).

The relevant block:

```json
{
  "providers": {
    "llama.cpp": {
      "modelOverrides": {
        "unsloth/Qwen3.8-27B-GGUF:Q8_0": {
          "reasoning": true,
          "thinkingLevelMap": {
            "off": "off", "minimal": null, "low": "low",
            "medium": "medium", "high": null, "xhigh": "xhigh", "max": null
          },
          "compat": {
            "thinkingFormat": "chat-template",
            "chatTemplateKwargs": {
              "enable_thinking": { "$var": "thinking.enabled" },
              "preserve_thinking": true,
              "reasoning_effort": { "$var": "thinking.effort", "omitWhenOff": true }
            }
          }
        }
      }
    }
  }
}
```

The same override is duplicated for `Qwen3.8-27B-high` and
`Qwen3.8-27B-low` (router aliases; overrides match by exact model ID).

Notes:

- `high`/`minimal`/`max` are hidden (`null`). If you want `high` in the
  picker, set `"high": "high"` — the template maps it to `xhigh` anyway.
- The llama.cpp server URL/key live in `~/.pi/agent/auth.json`
  (built-in provider credentials), so no secret is stored in
  `models.json`.

## Usage

1. In pi: `/model` → pick a `Qwen3.8-27B-*` entry (must be loaded on the
   router, e.g. via `/llama`).
2. The thinking-level picker now shows **off / low / medium / xhigh**.
3. Change level any time between turns; it applies to the next request
   only — no reload.

## Verification performed

1. **Config loads**: `pi --list-models` with the new `models.json` — no
   errors, `llama.cpp` models listed.
2. **Template supports the kwargs**: live `POST /v1/chat/completions`
   against the router with `chat_template_kwargs`:
   - `enable_thinking: true` + `reasoning_effort: "medium"` → 131 chars
     of `reasoning_content`
   - `enable_thinking: false` → **0** reasoning chars (proves kwargs
     reach the template)
   - `reasoning_effort: "high"` → accepted (maps to xhigh; the HF
     template would have raised)
3. **pi request path**: confirmed in
   `openai-completions.js` that `thinkingFormat: "chat-template"` +
   `chatTemplateKwargs` + `thinkingLevelMap` produces exactly these
   fields per request.

`scripts/verify-server.sh` re-runs the server-side smoke test.

## Caveats

- Effort is an **instruction**, not a budget: output length per level is
  not guaranteed. If you need a hard cap, add
  `thinking_budget`/`reasoning-budget` support to the template or use
  server-level `--reasoning-budget` (applies to all requests).
- `reasoning_effort` is only read when thinking is enabled; when
  `enable_thinking: false` it is omitted entirely (`omitWhenOff`).
- If you swap to a different GGUF (e.g. a raw HF conversion), re-check
  its baked template: the stock HF template *rejects* `"high"` (raises
  in jinja) and has no `preserve_thinking` handling identical to
  unsloth's.
