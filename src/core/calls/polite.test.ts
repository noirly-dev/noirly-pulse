import { describe, expect, it } from "vitest";
import { politePeer } from "./polite";

describe("politePeer", () => {
  it("treats the lexicographically smaller user id as polite", () => {
    expect(politePeer("aaa", "bbb")).toBe(true);
    expect(politePeer("bbb", "aaa")).toBe(false);
  });
});
