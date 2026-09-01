import { describe, expect, it } from "vitest";
import { qualityFromRtcStats, summarizeInboundStats } from "./stats";

describe("qualityFromRtcStats", () => {
  it("maps loss/rtt/jitter to labels", () => {
    expect(qualityFromRtcStats({ packetLoss: 0.01, rttMs: 80, jitterMs: 10 })).toBe("good");
    expect(qualityFromRtcStats({ packetLoss: 0.05, rttMs: 200, jitterMs: 40 })).toBe("ok");
    expect(qualityFromRtcStats({ packetLoss: 0.2, rttMs: 80, jitterMs: 10 })).toBe("poor");
  });
});

describe("summarizeInboundStats", () => {
  it("computes loss from inbound audio RTP", () => {
    const summary = summarizeInboundStats([
      { type: "inbound-rtp", kind: "audio", packetsLost: 2, packetsReceived: 98, jitter: 0.01 },
      { type: "candidate-pair", state: "succeeded", nominated: true, currentRoundTripTime: 0.08 },
    ]);
    expect(summary.packetLoss).toBeCloseTo(0.02);
    expect(summary.rttMs).toBeCloseTo(80);
    expect(summary.jitterMs).toBeCloseTo(10);
  });
});
