import { describe, expect, it } from "vitest";
import { isConversationMuted, shouldDeliverNotification } from "./should-notify";

describe("shouldDeliverNotification", () => {
  it("blocks all when pref is none", () => {
    expect(shouldDeliverNotification("none", "dm")).toBe(false);
    expect(shouldDeliverNotification("none", "mention")).toBe(false);
  });

  it("allows dm, mention, and thread_reply in mentions mode", () => {
    expect(shouldDeliverNotification("mentions", "dm")).toBe(true);
    expect(shouldDeliverNotification("mentions", "mention")).toBe(true);
    expect(shouldDeliverNotification("mentions", "thread_reply")).toBe(true);
  });

  it("allows everything in all mode", () => {
    expect(shouldDeliverNotification("all", "mention")).toBe(true);
    expect(shouldDeliverNotification("all", "dm")).toBe(true);
  });
});

describe("isConversationMuted", () => {
  it("returns false when mutedUntil is null", () => {
    expect(isConversationMuted(null)).toBe(false);
  });

  it("returns true when mutedUntil is in the future", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isConversationMuted(future)).toBe(true);
  });
});
