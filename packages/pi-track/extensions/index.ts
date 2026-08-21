/**
 * pi-track — Pi extension entry point.
 *
 * Tracks per-session performance stats and writes one markdown report per session
 * into `<cwd>/pi_track/<sessionId>.md`, where `<cwd>` is the directory Pi was started in.
 *
 * Captured:
 *   - prompt/finish timestamps (agent runs)
 *   - per-LLM-call (turn) token usage + cost, broken down by model
 *   - compactions applied (reason, tokens before, summary size, summarize cost)
 *   - model changes
 *
 * Set `PI_TRACK=0` in the environment to disable tracking entirely.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { SessionTracker, deriveFileName, TRACK_DIR_NAME, type TokenUsage, type TurnEndInfo } from "../src/track.js";

/** Minimal structural view of an assistant message — avoids importing pi-ai types here. */
interface AssistantLike {
  role: string;
  provider?: string;
  model?: string;
  stopReason?: string;
  usage?: unknown;
  content?: Array<{ type?: string; text?: string }>;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Map pi's `Usage` (or any compatible object) onto our normalized {@link TokenUsage}. */
function toTokenUsage(u: unknown): TokenUsage | null {
  if (!u || typeof u !== "object") return null;
  const x = u as Record<string, unknown>;
  const cost = (x.cost ?? {}) as Record<string, unknown>;
  return {
    input: num(x.input),
    output: num(x.output),
    cacheRead: num(x.cacheRead),
    cacheWrite: num(x.cacheWrite),
    reasoning: x.reasoning != null ? num(x.reasoning) : undefined,
    totalTokens: num(x.totalTokens),
    cost: {
      input: num(cost.input),
      output: num(cost.output),
      cacheRead: num(cost.cacheRead),
      cacheWrite: num(cost.cacheWrite),
      total: num(cost.total),
    },
  };
}

/** Extract the reportable details from a turn's assistant message. */
function summarizeAssistantMessage(message: unknown): TurnEndInfo | null {
  const msg = message as AssistantLike;
  if (!msg || msg.role !== "assistant") return null;
  const content = Array.isArray(msg.content) ? msg.content : [];
  let toolCalls = 0;
  let textChars = 0;
  for (const part of content) {
    if (part?.type === "toolCall") toolCalls += 1;
    else if (part?.type === "text") textChars += part.text?.length ?? 0;
  }
  return {
    model: msg.provider && msg.model ? `${msg.provider}/${msg.model}` : msg.model ?? null,
    stopReason: msg.stopReason ?? null,
    toolCalls,
    textChars,
    usage: toTokenUsage(msg.usage),
  };
}

export default function (pi: ExtensionAPI): void {
  if (process.env.PI_TRACK === "0") return;

  let tracker: SessionTracker | null = null;
  let outDir: string | null = null;

  const flush = (): void => {
    if (!tracker || !outDir) return;
    try {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, deriveFileName(tracker.stats)), tracker.render(), "utf8");
    } catch (err) {
      console.error("[pi-track] failed to write report:", err);
    }
  };

  pi.on("session_start", (_event, ctx) => {
    const sm = ctx.sessionManager;
    tracker = new SessionTracker({
      sessionId: sm.getSessionId(),
      cwd: ctx.cwd,
      sessionFile: sm.getSessionFile() ?? null,
      sessionName: sm.getSessionName() ?? null,
    });
    outDir = join(ctx.cwd, TRACK_DIR_NAME);
    flush();
  });

  pi.on("session_info_changed", (event, _ctx) => {
    if (tracker && event.name) tracker.setSessionName(event.name);
    flush();
  });

  pi.on("model_select", (event, _ctx) => {
    if (!tracker) return;
    const to = `${event.model.provider}/${event.model.id}`;
    const from = event.previousModel ? `${event.previousModel.provider}/${event.previousModel.id}` : null;
    tracker.recordModelChange(Date.now(), from, to, event.source);
    flush();
  });

  pi.on("before_agent_start", (event, _ctx) => {
    tracker?.setPendingPrompt(event.prompt);
  });

  pi.on("agent_start", (_event, _ctx) => {
    tracker?.runStarted(Date.now());
    flush();
  });

  pi.on("turn_start", (event, _ctx) => {
    tracker?.turnStarted(event.turnIndex, event.timestamp ?? Date.now());
  });

  pi.on("turn_end", (event, _ctx) => {
    if (!tracker) return;
    tracker.turnEnded(event.turnIndex, Date.now(), summarizeAssistantMessage(event.message));
    flush();
  });

  pi.on("agent_settled", (_event, _ctx) => {
    tracker?.runFinished(Date.now());
    flush();
  });

  pi.on("session_compact", (event, _ctx) => {
    if (!tracker) return;
    const entry = event.compactionEntry as { timestamp?: string; tokensBefore?: number; summary?: string; usage?: unknown };
    tracker.compacted({
      ts: entry.timestamp ? Date.parse(entry.timestamp) || Date.now() : Date.now(),
      reason: event.reason,
      tokensBefore: num(entry.tokensBefore),
      summaryChars: entry.summary?.length ?? 0,
      usage: toTokenUsage(entry.usage),
    });
    flush();
  });

  pi.on("session_shutdown", (_event, _ctx) => {
    flush();
  });
}
