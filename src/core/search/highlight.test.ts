import { describe, expect, it } from "vitest";
import { highlightTerms } from "./highlight";

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
