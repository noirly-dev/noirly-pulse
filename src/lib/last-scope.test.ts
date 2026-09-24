import { describe, expect, it } from "vitest";
import { isLastScopePath, scopePathFrom } from "./last-scope";

const id = "6ab4dadaed5078924898cdcf";
const ws = "6ab4d9c869011047ebbe8df2";

describe("last scope", () => {
  it("normalises conversation paths", () => {
    expect(scopePathFrom(`/dm/${id}/thread/${ws}`)).toBe(`/dm/${id}`);
    expect(scopePathFrom(`/w/${ws}/channel/${id}/thread/${ws}`)).toBe(`/w/${ws}/channel/${id}`);
    expect(scopePathFrom(`/w/${ws}/members`)).toBe(`/w/${ws}`);
    expect(scopePathFrom("/inbox")).toBeNull();
  });

  it("only accepts internal conversation paths", () => {
    expect(isLastScopePath(`/dm/${id}`)).toBe(true);
    expect(isLastScopePath(`/w/${ws}/channel/${id}`)).toBe(true);
    expect(isLastScopePath("//evil.example")).toBe(false);
    expect(isLastScopePath(`/dm/${id}?x=1`)).toBe(false);
    expect(isLastScopePath("https://evil.example/dm/x")).toBe(false);
    expect(isLastScopePath(undefined)).toBe(false);
  });
});
