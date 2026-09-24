import { describe, expect, it } from "vitest";
import { lastSeenLabel } from "./last-seen";

const now = Date.parse("2026-09-24T12:00:00Z");

describe("lastSeenLabel", () => {
  it("buckets by recency", () => {
    expect(lastSeenLabel("2026-09-24T11:59:30Z", now)).toBe("Last seen just now");
    expect(lastSeenLabel("2026-09-24T11:45:00Z", now)).toBe("Last seen 15m ago");
    expect(lastSeenLabel("2026-09-24T09:00:00Z", now)).toBe("Last seen 3h ago");
    expect(lastSeenLabel("2026-09-21T12:00:00Z", now)).toBe("Last seen 3d ago");
  });

  it("handles invalid input", () => {
    expect(lastSeenLabel("nope", now)).toBe("Offline");
  });
});
