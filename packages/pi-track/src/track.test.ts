import { describe, it, expect } from "vitest";
import {
  SessionTracker,
  deriveFileName,
  renderStats,
  TRACK_DIR_NAME,
  type TokenUsage,
  type SessionStats,
} from "./track.js";

/** Build a fully-populated TokenUsage from a sparse partial. */
function usage(partial: Partial<TokenUsage> & { cost?: Partial<TokenUsage["cost"]> } = {}): TokenUsage {
  return {
    input: partial.input ?? 0,
    output: partial.output ?? 0,
    cacheRead: partial.cacheRead ?? 0,
    cacheWrite: partial.cacheWrite ?? 0,
    reasoning: partial.reasoning,
    totalTokens: partial.totalTokens ?? 0,
    cost: {
      input: partial.cost?.input ?? 0,
      output: partial.cost?.output ?? 0,
      cacheRead: partial.cost?.cacheRead ?? 0,
      cacheWrite: partial.cost?.cacheWrite ?? 0,
      total: partial.cost?.total ?? 0,
    },
  };
}

function emptyStats(overrides: Partial<SessionStats> = {}): SessionStats {
  return {
    sessionId: "abc-123",
    sessionFile: null,
    sessionName: null,
    cwd: "/tmp/proj",
    startedAt: 1_000_000,
    lastUpdatedAt: 1_000_000,
    currentModel: null,
    runs: [],
    turns: [],
    compactions: [],
    modelChanges: [],
    ...overrides,
  };
}

describe("TRACK_DIR_NAME", () => {
  it("is the documented output directory", () => {
    expect(TRACK_DIR_NAME).toBe("pi_track");
  });
});

describe("deriveFileName", () => {
  it("uses the session id with a .md extension", () => {
    expect(deriveFileName(emptyStats({ sessionId: "abc-123" }))).toBe("abc-123.md");
  });

  it("sanitizes characters that are unsafe in file names", () => {
    expect(deriveFileName(emptyStats({ sessionId: "a/b:c?d*e" }))).toBe("a-b-c-d-e.md");
  });

  it("falls back to 'session' for an empty id", () => {
    expect(deriveFileName(emptyStats({ sessionId: "///" }))).toBe("session.md");
  });
});

describe("SessionTracker aggregation", () => {
  it("pairs run start/finish and records the prompt", () => {
    const t = new SessionTracker({ sessionId: "s1", cwd: "/w" });
    t.setPendingPrompt("do the thing");
    t.runStarted(1000);
    t.runFinished(4200);

    expect(t.stats.runs).toHaveLength(1);
    expect(t.stats.runs[0]).toMatchObject({ index: 1, prompt: "do the thing", startTs: 1000, finishTs: 4200 });
  });

  it("clears the pending prompt after a run starts", () => {
    const t = new SessionTracker({ sessionId: "s1", cwd: "/w" });
    t.setPendingPrompt("first");
    t.runStarted(1000);
    t.runStarted(2000); // no new prompt set

    expect(t.stats.runs[0].prompt).toBe("first");
    expect(t.stats.runs[1].prompt).toBe("");
  });

  it("closes the most recent open run on finish", () => {
    const t = new SessionTracker({ sessionId: "s1", cwd: "/w" });
    t.runStarted(1000);
    t.runStarted(2000);
    t.runFinished(3000);

    expect(t.stats.runs[0].finishTs).toBeNull();
    expect(t.stats.runs[1].finishTs).toBe(3000);
  });

  it("records turn usage and updates the current model", () => {
    const t = new SessionTracker({ sessionId: "s1", cwd: "/w" });
    t.turnStarted(0, 1000);
    t.turnEnded(0, 1500, {
      model: "anthropic/claude",
      stopReason: "stop",
      toolCalls: 2,
      textChars: 100,
      usage: usage({ input: 10, output: 5, totalTokens: 15, cost: { total: 0.01 } }),
    });

    expect(t.stats.turns).toHaveLength(1);
    expect(t.stats.turns[0]).toMatchObject({ index: 0, startTs: 1000, endTs: 1500, model: "anthropic/claude", toolCalls: 2 });
    expect(t.stats.currentModel).toBe("anthropic/claude");
  });

  it("keeps turns sorted by index even when events arrive out of order", () => {
    const t = new SessionTracker({ sessionId: "s1", cwd: "/w" });
    t.turnEnded(2, 3000, null);
    t.turnEnded(0, 1000, null);
    t.turnEnded(1, 2000, null);

    expect(t.stats.turns.map((x) => x.index)).toEqual([0, 1, 2]);
  });

  it("records compactions and model changes", () => {
    const t = new SessionTracker({ sessionId: "s1", cwd: "/w" });
    t.compacted({ ts: 5000, reason: "threshold", tokensBefore: 120_000, summaryChars: 850, usage: null });
    t.recordModelChange(6000, "anthropic/claude", "openai/gpt", "cycle");

    expect(t.stats.compactions[0]).toMatchObject({ reason: "threshold", tokensBefore: 120_000 });
    expect(t.stats.modelChanges[0]).toMatchObject({ from: "anthropic/claude", to: "openai/gpt", source: "cycle" });
    expect(t.stats.currentModel).toBe("openai/gpt");
  });
});

describe("renderStats — empty session", () => {
  it("emits every section with a (none) placeholder", () => {
    const md = renderStats(emptyStats());
    for (const header of [
      "## Overview",
      "## Totals",
      "## Prompts / Runs",
      "## LLM Calls (per turn)",
      "## Token Usage by Model",
      "## Compactions",
      "## Model Changes",
    ]) {
      expect(md).toContain(header);
    }
    expect(md).toContain("_(none)_");
    expect(md).toContain("| Total tokens | 0 |");
    expect(md).toContain("| Est. cost | $0.000000 |");
  });
});

describe("renderStats — populated session", () => {
  function build(): SessionTracker {
    const t = new SessionTracker({ sessionId: "sess-1", cwd: "/w", sessionName: "my work" });
    t.setPendingPrompt("refactor the parser");
    t.runStarted(1_000_000);
    t.turnStarted(0, 1_000_100);
    t.turnEnded(0, 1_000_900, {
      model: "anthropic/claude",
      stopReason: "stop",
      toolCalls: 2,
      textChars: 100,
      usage: usage({ input: 1234, output: 567, cacheRead: 89, cacheWrite: 12, totalTokens: 1802, cost: { total: 0.012345 } }),
    });
    t.turnStarted(1, 1_001_000);
    t.turnEnded(1, 1_001_200, {
      model: "openai/gpt",
      stopReason: "toolUse",
      toolCalls: 1,
      textChars: 40,
      usage: usage({ input: 100, output: 50, totalTokens: 150, cost: { total: 0.000655 } }),
    });
    t.runFinished(1_002_000);
    t.compacted({ ts: 1_003_000, reason: "threshold", tokensBefore: 120_000, summaryChars: 850, usage: null });
    return t;
  }

  it("renders the session name in the title and overview", () => {
    const md = renderStats(build().stats);
    expect(md).toContain("# Pi Session Track — my work");
    expect(md).toContain("| Name | my work |");
  });

  it("computes aggregate token totals with grouping", () => {
    const md = renderStats(build().stats);
    expect(md).toContain("| Input tokens | 1,334 |");
    expect(md).toContain("| Output tokens | 617 |");
    expect(md).toContain("| Cache read | 89 |");
    expect(md).toContain("| Cache write | 12 |");
    expect(md).toContain("| Total tokens | 1,952 |");
    expect(md).toContain("| Est. cost | $0.013000 |");
    expect(md).toContain("| LLM calls (turns) | 2 |");
    expect(md).toContain("| Prompts (runs) | 1 |");
    expect(md).toContain("| Compactions | 1 |");
  });

  it("renders a per-turn row with usage and duration", () => {
    const md = renderStats(build().stats);
    // turn 0: 800ms duration, anthropic/claude, in 1,234 out 567 total 1,802 cost $0.012345
    expect(md).toContain("| 0 |");
    expect(md).toContain("anthropic/claude");
    expect(md).toContain("$0.012345");
    expect(md).toContain("800ms");
  });

  it("renders a per-model breakdown sorted by cost (desc)", () => {
    const md = renderStats(build().stats);
    const claudeIdx = md.indexOf("`anthropic/claude` | 1 |");
    const gptIdx = md.indexOf("`openai/gpt` | 1 |");
    expect(claudeIdx).toBeGreaterThan(-1);
    expect(gptIdx).toBeGreaterThan(-1);
    expect(claudeIdx).toBeLessThan(gptIdx); // higher cost first
  });

  it("renders the compaction row", () => {
    const md = renderStats(build().stats);
    expect(md).toContain("| 1 |");
    expect(md).toContain("threshold");
    expect(md).toContain("120,000");
    expect(md).toContain("850");
  });

  it("renders run duration", () => {
    const md = renderStats(build().stats);
    // run: 1_000_000 -> 1_002_000 = 2.0s
    expect(md).toContain("| 2.0s |");
  });
});

describe("renderStats — formatting edge cases", () => {
  it("shows an em dash for missing usage on a turn", () => {
    const t = new SessionTracker({ sessionId: "s", cwd: "/w" });
    t.turnStarted(0, 1000);
    t.turnEnded(0, 1100, null);
    const md = renderStats(t.stats);
    expect(md).toContain("| — |");
  });

  it("escapes pipes and newlines in prompt cells", () => {
    const stats = emptyStats({
      runs: [{ index: 1, prompt: "a | b\nc", startTs: 0, finishTs: 100 }],
    });
    const md = renderStats(stats);
    expect(md).toContain("a \\| b c");
    expect(md).not.toContain("a | b\nc");
  });

  it("truncates very long prompts", () => {
    const stats = emptyStats({ runs: [{ index: 1, prompt: "x".repeat(200), startTs: 0, finishTs: 100 }] });
    const md = renderStats(stats);
    expect(md).toContain("…");
  });
});
