import { describe, expect, it } from "vitest";
import { callLogContent, formatCallDuration } from "./copy";

describe("callLogContent", () => {
  it("describes missed and declined calls", () => {
    expect(callLogContent("missed", "video")).toBe("Missed video call");
    expect(callLogContent("declined", "audio")).toBe("Declined voice call");
    expect(callLogContent("cancelled", "audio")).toBe("Cancelled voice call");
  });
});

describe("formatCallDuration", () => {
  it("formats mm:ss", () => {
    expect(formatCallDuration(0)).toBe("0:00");
    expect(formatCallDuration(75)).toBe("1:15");
    expect(formatCallDuration(null)).toBeNull();
  });
});
