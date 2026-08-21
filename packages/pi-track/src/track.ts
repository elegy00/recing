/**
 * Core (dependency-free) logic for the pi-track extension.
 *
 * This module is intentionally free of any `@earendil-works/*` imports so it can be
 * unit-tested in isolation and reused without pulling in the pi runtime. The pi
 * extension entry (`extensions/index.ts`) maps pi's event payloads onto these plain
 * types and drives a {@link SessionTracker}.
 */

/** Directory (relative to the cwd Pi was started in) that track files are written to. */
export const TRACK_DIR_NAME = "pi_track";

/**
 * Normalized token usage for a single LLM call. Mirrors the subset of pi's `Usage`
 * that we report. Kept local so this module has no external type dependencies.
 */
export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** Reasoning/thinking tokens (subset of `output`). Undefined when the provider does not report it. */
  reasoning?: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

/** One LLM call (a "turn" in pi's lifecycle). This is the unit of per-part token usage. */
export interface TurnRecord {
  /** Global turn index as reported by pi (`turn_start`/`turn_end`). */
  index: number;
  startTs: number;
  endTs: number | null;
  /** `provider/model` identifier, or null when unknown. */
  model: string | null;
  stopReason: string | null;
  toolCalls: number;
  textChars: number;
  usage: TokenUsage | null;
}

/** One user prompt and the wall-clock window in which Pi processed it (agent_start → agent_settled). */
export interface RunRecord {
  index: number;
  /** Truncated user prompt text. */
  prompt: string;
  startTs: number | null;
  finishTs: number | null;
}

/** A context compaction that was applied during the session. */
export interface CompactionRecord {
  ts: number;
  reason: "manual" | "threshold" | "overflow" | string;
  tokensBefore: number;
  summaryChars: number;
  /** Usage of the LLM call(s) that produced the summary, when available. */
  usage: TokenUsage | null;
}

/** A model switch observed during the session. */
export interface ModelChangeRecord {
  ts: number;
  from: string | null;
  to: string;
  source: string;
}

/** Aggregated, renderable state for a single session. */
export interface SessionStats {
  sessionId: string;
  sessionFile: string | null;
  sessionName: string | null;
  cwd: string;
  startedAt: number;
  lastUpdatedAt: number;
  currentModel: string | null;
  runs: RunRecord[];
  turns: TurnRecord[];
  compactions: CompactionRecord[];
  modelChanges: ModelChangeRecord[];
}

/** Payload describing the assistant message that ended a turn. */
export interface TurnEndInfo {
  model: string | null;
  stopReason: string | null;
  toolCalls: number;
  textChars: number;
  usage: TokenUsage | null;
}

export interface TrackerOptions {
  sessionId: string;
  cwd: string;
  sessionFile?: string | null;
  sessionName?: string | null;
}

/**
 * Accumulates session stats from a stream of lifecycle events.
 *
 * The tracker is stateful and ordered: feed it events as they happen (or in order)
 * and call {@link render} to get the current markdown report. All timestamps are
 * epoch milliseconds.
 */
export class SessionTracker {
  readonly stats: SessionStats;
  private pendingPrompt: string | null = null;

  constructor(opts: TrackerOptions) {
    const now = Date.now();
    this.stats = {
      sessionId: opts.sessionId,
      sessionFile: opts.sessionFile ?? null,
      sessionName: opts.sessionName ?? null,
      cwd: opts.cwd,
      startedAt: now,
      lastUpdatedAt: now,
      currentModel: null,
      runs: [],
      turns: [],
      compactions: [],
      modelChanges: [],
    };
  }

  private touch(): void {
    this.stats.lastUpdatedAt = Date.now();
  }

  setSessionName(name: string): void {
    this.stats.sessionName = name;
    this.touch();
  }

  setCurrentModel(model: string | null): void {
    this.stats.currentModel = model;
    this.touch();
  }

  /** Remember the most recent user prompt so the next {@link runStarted} can attach it. */
  setPendingPrompt(prompt: string): void {
    this.pendingPrompt = prompt;
  }

  /** A new agent run begins (user submitted a prompt). */
  runStarted(ts: number): void {
    const index = this.stats.runs.length + 1;
    this.stats.runs.push({ index, prompt: this.pendingPrompt ?? "", startTs: ts, finishTs: null });
    this.pendingPrompt = null;
    this.touch();
  }

  /** The current agent run has fully settled (no retry/compaction/follow-up left). */
  runFinished(ts: number): void {
    const open = [...this.stats.runs].reverse().find((r) => r.finishTs == null);
    if (open) {
      open.finishTs = ts;
    } else {
      // Defensive: a settle without a matching start.
      this.stats.runs.push({ index: this.stats.runs.length + 1, prompt: "", startTs: ts, finishTs: ts });
    }
    this.touch();
  }

  /** A turn (single LLM call) begins. */
  turnStarted(index: number, ts: number): void {
    const existing = this.stats.turns.find((t) => t.index === index);
    if (existing) {
      existing.startTs = ts;
    } else {
      this.stats.turns.push({
        index,
        startTs: ts,
        endTs: null,
        model: null,
        stopReason: null,
        toolCalls: 0,
        textChars: 0,
        usage: null,
      });
    }
    this.touch();
  }

  /** A turn ends; attach the assistant message's model/usage details. */
  turnEnded(index: number, ts: number, info: TurnEndInfo | null): void {
    let turn = this.stats.turns.find((t) => t.index === index);
    if (!turn) {
      turn = { index, startTs: ts, endTs: null, model: null, stopReason: null, toolCalls: 0, textChars: 0, usage: null };
      this.stats.turns.push(turn);
    }
    turn.endTs = ts;
    if (info) {
      turn.model = info.model;
      turn.stopReason = info.stopReason;
      turn.toolCalls = info.toolCalls;
      turn.textChars = info.textChars;
      turn.usage = info.usage;
      if (info.model) this.stats.currentModel = info.model;
    }
    this.stats.turns.sort((a, b) => a.index - b.index);
    this.touch();
  }

  /** A compaction was applied. */
  compacted(record: CompactionRecord): void {
    this.stats.compactions.push(record);
    this.touch();
  }

  /** The active model changed. */
  recordModelChange(ts: number, from: string | null, to: string, source: string): void {
    this.stats.modelChanges.push({ ts, from, to, source });
    this.stats.currentModel = to;
    this.touch();
  }

  /** Render the current state as a markdown report. */
  render(): string {
    return renderStats(this.stats);
  }
}

/** Derive the stable per-session file name (one `.md` per session). */
export function deriveFileName(stats: SessionStats): string {
  return `${safeName(stats.sessionId)}.md`;
}

function safeName(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "session";
}

/**
 * The report template. Pure function of {@link SessionStats} — deterministic and
 * easy to test. Every section is always emitted (with `_(none)_` when empty) so the
 * file shape stays stable across sessions.
 */
export function renderStats(s: SessionStats): string {
  const lines: string[] = [];
  const push = (line = ""): void => {
    lines.push(line);
  };

  const models = uniqueModels(s);
  const totals = computeTotals(s.turns);
  const byModel = computeByModel(s.turns);

  push(`# Pi Session Track — ${s.sessionName ?? s.sessionId}`);
  push();
  push("> Auto-generated by `@recing/pi-track`. Do not edit by hand.");
  push();

  push("## Overview");
  push();
  push("| Field | Value |");
  push("| --- | --- |");
  push(`| Session ID | \`${s.sessionId}\` |`);
  push(`| Name | ${s.sessionName ?? "(unnamed)"} |`);
  push(`| Session file | ${s.sessionFile ? `\`${s.sessionFile}\`` : "(ephemeral)"} |`);
  push(`| Working dir | \`${s.cwd}\` |`);
  push(`| Model(s) | ${models.length > 0 ? models.map((m) => `\`${m}\``).join(", ") : "—"} |`);
  push(`| Started (UTC) | ${fmtTime(s.startedAt)} |`);
  push(`| Last updated (UTC) | ${fmtTime(s.lastUpdatedAt)} |`);
  push(`| Wall time | ${fmtDuration(s.lastUpdatedAt - s.startedAt)} |`);
  push();

  push("## Totals");
  push();
  push("| Metric | Value |");
  push("| --- | --- |");
  push(`| Prompts (runs) | ${s.runs.length} |`);
  push(`| LLM calls (turns) | ${s.turns.length} |`);
  push(`| Compactions | ${s.compactions.length} |`);
  push(`| Input tokens | ${group(totals.input)} |`);
  push(`| Output tokens | ${group(totals.output)} |`);
  push(`| Cache read | ${group(totals.cacheRead)} |`);
  push(`| Cache write | ${group(totals.cacheWrite)} |`);
  if (totals.reasoning > 0) push(`| Reasoning tokens | ${group(totals.reasoning)} |`);
  push(`| Total tokens | ${group(totals.totalTokens)} |`);
  push(`| Est. cost | ${fmtCost(totals.cost)} |`);
  push();

  push("## Prompts / Runs");
  push();
  if (s.runs.length === 0) {
    push("_(none)_");
  } else {
    push("| # | Started (UTC) | Finished (UTC) | Duration | Prompt |");
    push("| --- | --- | --- | --- | --- |");
    for (const r of s.runs) {
      const dur = r.startTs != null && r.finishTs != null ? fmtDuration(r.finishTs - r.startTs) : "—";
      push(`| ${r.index} | ${fmtTime(r.startTs)} | ${fmtTime(r.finishTs)} | ${dur} | ${mdCell(r.prompt)} |`);
    }
  }
  push();

  push("## LLM Calls (per turn)");
  push();
  if (s.turns.length === 0) {
    push("_(none)_");
  } else {
    push("| Turn | Time (UTC) | Dur | Model | In | Out | CacheR | CacheW | Total | Cost | Stop | Tools | Text ch |");
    push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const t of s.turns) {
      const u = t.usage;
      const dur = t.endTs != null ? fmtDuration(t.endTs - t.startTs) : "—";
      push(
        `| ${t.index} | ${fmtTime(t.startTs)} | ${dur} | ${t.model ?? "—"} | ` +
          `${u ? group(u.input) : "—"} | ${u ? group(u.output) : "—"} | ${u ? group(u.cacheRead) : "—"} | ` +
          `${u ? group(u.cacheWrite) : "—"} | ${u ? group(u.totalTokens) : "—"} | ${u ? fmtCost(u.cost.total) : "—"} | ` +
          `${t.stopReason ?? "—"} | ${t.toolCalls} | ${group(t.textChars)} |`,
      );
    }
  }
  push();

  push("## Token Usage by Model");
  push();
  if (byModel.length === 0) {
    push("_(none)_");
  } else {
    push("| Model | Calls | In | Out | CacheR | CacheW | Total | Cost |");
    push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const m of byModel) {
      push(
        `| \`${m.model}\` | ${m.calls} | ${group(m.input)} | ${group(m.output)} | ${group(m.cacheRead)} | ` +
          `${group(m.cacheWrite)} | ${group(m.totalTokens)} | ${fmtCost(m.cost)} |`,
      );
    }
  }
  push();

  push("## Compactions");
  push();
  if (s.compactions.length === 0) {
    push("_(none)_");
  } else {
    push("| # | Time (UTC) | Reason | Tokens before | Summary ch | Summarize cost |");
    push("| --- | --- | --- | --- | --- | --- |");
    s.compactions.forEach((c, i) => {
      push(
        `| ${i + 1} | ${fmtTime(c.ts)} | ${c.reason} | ${group(c.tokensBefore)} | ${group(c.summaryChars)} | ` +
          `${c.usage ? fmtCost(c.usage.cost.total) : "—"} |`,
      );
    });
  }
  push();

  push("## Model Changes");
  push();
  if (s.modelChanges.length === 0) {
    push("_(none)_");
  } else {
    push("| Time (UTC) | From | To | Source |");
    push("| --- | --- | --- | --- |");
    for (const m of s.modelChanges) {
      push(`| ${fmtTime(m.ts)} | ${m.from ?? "—"} | \`${m.to}\` | ${m.source} |`);
    }
  }
  push();

  return lines.join("\n");
}

function uniqueModels(s: SessionStats): string[] {
  const set = new Set<string>();
  for (const t of s.turns) if (t.model) set.add(t.model);
  for (const m of s.modelChanges) set.add(m.to);
  if (s.currentModel) set.add(s.currentModel);
  return [...set];
}

interface Totals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  totalTokens: number;
  cost: number;
}

function computeTotals(turns: TurnRecord[]): Totals {
  const t: Totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0, cost: 0 };
  for (const turn of turns) {
    const u = turn.usage;
    if (!u) continue;
    t.input += u.input;
    t.output += u.output;
    t.cacheRead += u.cacheRead;
    t.cacheWrite += u.cacheWrite;
    t.reasoning += u.reasoning ?? 0;
    t.totalTokens += u.totalTokens;
    t.cost += u.cost.total;
  }
  return t;
}

interface ModelAgg {
  model: string;
  calls: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
}

function computeByModel(turns: TurnRecord[]): ModelAgg[] {
  const map = new Map<string, ModelAgg>();
  for (const turn of turns) {
    const u = turn.usage;
    if (!u || !turn.model) continue;
    let agg = map.get(turn.model);
    if (!agg) {
      agg = { model: turn.model, calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0 };
      map.set(turn.model, agg);
    }
    agg.calls += 1;
    agg.input += u.input;
    agg.output += u.output;
    agg.cacheRead += u.cacheRead;
    agg.cacheWrite += u.cacheWrite;
    agg.totalTokens += u.totalTokens;
    agg.cost += u.cost.total;
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost || a.model.localeCompare(b.model));
}

/** Group an integer with thousands separators (locale-independent). */
function group(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Format epoch ms as a UTC wall-clock string, or an em dash when null. */
function fmtTime(ms: number | null): string {
  if (ms == null) return "—";
  return new Date(ms).toISOString().replace("T", " ").replace("Z", "");
}

/** Human-friendly duration from milliseconds. */
function fmtDuration(ms: number | null): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem.toString().padStart(2, "0")}s`;
}

/** Format a dollar cost with 6 decimals. */
function fmtCost(c: number): string {
  return `$${c.toFixed(6)}`;
}

/** Make a string safe for use inside a markdown table cell (single line, bounded). */
function mdCell(text: string): string {
  const cleaned = text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
  const short = cleaned.length > 80 ? `${cleaned.slice(0, 77)}…` : cleaned;
  return short || "(empty)";
}
