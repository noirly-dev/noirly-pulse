import { describe, expect, it } from "vitest";
import { highlightTerms, snippetAround } from "./highlight";

describe("highlightTerms", () => {
  it("marks matching terms", () => {
    const segments = highlightTerms("hello world hello", "hello");
    expect(segments.some((s) => s.highlight && s.text === "hello")).toBe(true);
    expect(segments.some((s) => !s.highlight && s.text === " world ")).toBe(true);
  });

  it("returns plain text when query is too short", () => {
    expect(highlightTerms("abc", "a")).toEqual([{ text: "abc", highlight: false }]);
  });
});

describe("snippetAround", () => {
  it("returns short text unchanged, with mention markup collapsed", () => {
    expect(snippetAround("hi [@Ana](pulse://user/abc) see **this**", "see")).toBe(
      "hi @Ana see this",
    );
  });

  it("centres long text on the first match and marks cuts", () => {
    const long = `${"a ".repeat(200)}needle ${"b ".repeat(200)}`;
    const snippet = snippetAround(long, "needle", 60);
    expect(snippet).toContain("needle");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(62);
  });
});
