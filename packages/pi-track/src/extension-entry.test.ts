import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import extension from "../extensions/index.js";

type Handler = (event: unknown, ctx: unknown) => unknown;

/** Minimal mock of the pi ExtensionAPI surface the extension uses (just `on`). */
function makePi() {
  const handlers = new Map<string, Handler[]>();
  const api = {
    on(event: string, handler: Handler): void {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
  };
  return {
    api,
    fire(event: string, payload: unknown, ctx: unknown): void {
      for (const h of handlers.get(event) ?? []) h(payload, ctx);
    },
    registered(): string[] {
      return [...handlers.keys()];
    },
  };
}

function makeCtx(cwd: string, id = "sess-xyz") {
  return {
    cwd,
    sessionManager: {
      getSessionId: () => id,
      getSessionFile: () => join(cwd, ".pi", "sessions", `${id}.jsonl`),
      getSessionName: () => undefined,
    },
  };
}

const usage = {
  input: 100,
  output: 50,
  cacheRead: 10,
  cacheWrite: 5,
  totalTokens: 165,
  cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
};

const assistantMsg = {
  role: "assistant",
  provider: "anthropic",
  model: "claude",
  stopReason: "stop",
  usage,
  content: [
    { type: "text", text: "hello world" },
    { type: "toolCall", id: "1", name: "read" },
  ],
};

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "pi-track-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("pi extension entry (integration)", () => {
  it("writes a report to <cwd>/pi_track as events arrive", () => {
    delete process.env.PI_TRACK;
    withTempDir((dir) => {
      const { api, fire } = makePi();
      extension(api);

      const ctx = makeCtx(dir);
      fire("session_start", { reason: "startup" }, ctx);
      fire("before_agent_start", { prompt: "do it" }, ctx);
      fire("agent_start", {}, ctx);
      fire("turn_start", { turnIndex: 0, timestamp: 1000 }, ctx);
      fire("turn_end", { turnIndex: 0, message: assistantMsg, toolResults: [] }, ctx);
      fire("agent_settled", {}, ctx);

      const file = join(dir, "pi_track", "sess-xyz.md");
      expect(existsSync(file)).toBe(true);
      const md = readFileSync(file, "utf8");
      expect(md).toContain("# Pi Session Track — sess-xyz");
      expect(md).toContain("do it");
      expect(md).toContain("anthropic/claude");
      expect(md).toContain("| Total tokens | 165 |");
    });
  });

  it("records a compaction with its reason and token count", () => {
    delete process.env.PI_TRACK;
    withTempDir((dir) => {
      const { api, fire } = makePi();
      extension(api);
      const ctx = makeCtx(dir);
      fire("session_start", { reason: "startup" }, ctx);
      fire(
        "session_compact",
        {
          compactionEntry: { timestamp: new Date(2000).toISOString(), tokensBefore: 999, summary: "sum", usage: undefined },
          reason: "threshold",
        },
        ctx,
      );

      const md = readFileSync(join(dir, "pi_track", "sess-xyz.md"), "utf8");
      expect(md).toContain("threshold");
      expect(md).toContain("999");
    });
  });

  it("records a model change", () => {
    delete process.env.PI_TRACK;
    withTempDir((dir) => {
      const { api, fire } = makePi();
      extension(api);
      const ctx = makeCtx(dir);
      fire("session_start", { reason: "startup" }, ctx);
      fire(
        "model_select",
        { model: { provider: "openai", id: "gpt" }, previousModel: { provider: "anthropic", id: "claude" }, source: "cycle" },
        ctx,
      );

      const md = readFileSync(join(dir, "pi_track", "sess-xyz.md"), "utf8");
      expect(md).toContain("`openai/gpt`");
      expect(md).toContain("anthropic/claude");
    });
  });

  it("registers no handlers and writes nothing when PI_TRACK=0", () => {
    process.env.PI_TRACK = "0";
    try {
      withTempDir((dir) => {
        const { api, fire, registered } = makePi();
        extension(api);
        expect(registered()).toHaveLength(0);

        const ctx = makeCtx(dir);
        fire("session_start", { reason: "startup" }, ctx);
        expect(existsSync(join(dir, "pi_track"))).toBe(false);
      });
    } finally {
      delete process.env.PI_TRACK;
    }
  });
});
