import { describe, expect, it } from "vitest";
import { reduce, extractTitle } from "./content-reducer.js";

describe("reduce", () => {
  it("strips script tags (except JSON-LD)", () => {
    const input = "<html><body><script>alert('xss')</script>Hello</body></html>";
    const result = reduce(input, 100);
    expect(result.text).not.toContain("alert");
    expect(result.text).toContain("Hello");
  });

  it("preserves JSON-LD script blocks", () => {
    const input = `<html><body>
<script type="application/ld+json">{"@context":"schema.org"}</script>
<p>Recipe content</p>
</body></html>`;
    const result = reduce(input, 500);
    // JSON-LD should survive since it's preserved during script stripping
    expect(result.text).toContain("schema.org");
  });

  it("strips style tags", () => {
    const input = "<html><head><style>.foo{color:red}</style></head><body>Hello</body></html>";
    const result = reduce(input, 100);
    expect(result.text).not.toContain("color");
    expect(result.text).toContain("Hello");
  });

  it("strips HTML comments", () => {
    const input = "<!-- hidden -->Visible content<!-- another comment -->";
    const result = reduce(input, 100);
    expect(result.text).not.toContain("hidden");
    expect(result.text).toContain("Visible content");
  });

  it("caps content length", () => {
    const input = "A".repeat(200);
    const result = reduce(input, 50);
    expect(result.truncated).toBe(true);
    expect(result.reducedLength).toBeLessThanOrEqual(50);
  });

  it("does not truncate when under limit", () => {
    const input = "Short content";
    const result = reduce(input, 200);
    expect(result.truncated).toBe(false);
    expect(result.text).toBe("Short content");
  });

  it("handles empty string input", () => {
    const result = reduce("", 100);
    expect(result.originalLength).toBe(0);
    expect(result.reducedLength).toBe(0);
    expect(result.truncated).toBe(false);
    expect(result.text).toBe("");
  });

  it("handles null input", () => {
    const result = reduce(null, 100);
    expect(result.text).toBe("");
  });

  it("handles undefined input", () => {
    const result = reduce(undefined, 100);
    expect(result.text).toBe("");
  });

  it("preserves list structure", () => {
    const input = "<ul><li>Flour</li><li>Sugar</li></ul>";
    const result = reduce(input, 200);
    expect(result.text).toContain("Flour");
    expect(result.text).toContain("Sugar");
  });

  it("preserves headings", () => {
    const input = "<h1>Ingredients</h1><p>Stuff</p>";
    const result = reduce(input, 200);
    expect(result.text).toContain("Ingredients");
  });

  it("truncates at word boundary when possible", () => {
    // Text where maxChars cuts mid-word — should back up to last space if past half-way
    const input = "One two three four five six seven eight nine ten";
    const result = reduce(input, 20);
    expect(result.truncated).toBe(true);
    // Should not end in the middle of a word
    expect(result.text.endsWith(" ")).toBe(false);
    expect(result.reducedLength).toBeLessThanOrEqual(20);
  });

  it("returns correct length metadata", () => {
    const input = "Hello world";
    const result = reduce(input, 500);
    expect(result.originalLength).toBe(11);
    expect(result.reducedLength).toBe(11);
  });

  it("strips SVG tags", () => {
    const input = "<div><svg>icon</svg>Visible text</div>";
    const result = reduce(input, 200);
    expect(result.text).not.toContain("icon");
    expect(result.text).toContain("Visible text");
  });
});

describe("extractTitle", () => {
  it("extracts title from HTML", () => {
    const html = "<html><head><title>My Awesome Recipe</title></head><body>...</body></html>";
    expect(extractTitle(html)).toBe("My Awesome Recipe");
  });

  it("returns null when no title tag", () => {
    expect(extractTitle("<html><body>No title tag</body></html>")).toBeNull();
  });

  it("returns null for empty title", () => {
    expect(extractTitle("<html><head><title>   </title></head></html>")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(extractTitle(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(extractTitle(undefined)).toBeNull();
  });

  it("trims whitespace from title", () => {
    const html = "<html><head><title>   Trimmed Title   </title></head></html>";
    expect(extractTitle(html)).toBe("Trimmed Title");
  });


});
