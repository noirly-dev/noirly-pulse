export type ConnectionQuality = "good" | "ok" | "poor" | "unknown";

export function qualityFromRtcStats(input: {
  packetLoss: number;
  rttMs: number;
  jitterMs: number;
}): ConnectionQuality {
  if (!Number.isFinite(input.packetLoss) || !Number.isFinite(input.rttMs)) return "unknown";
  if (input.packetLoss < 0.02 && input.rttMs < 150 && input.jitterMs < 30) return "good";
  if (input.packetLoss < 0.08 && input.rttMs < 400) return "ok";
  return "poor";
}

export function summarizeInboundStats(
  stats: Array<{
    type: string;
    kind?: string;
    packetsLost?: number;
    packetsReceived?: number;
    jitter?: number;
    currentRoundTripTime?: number;
    state?: string;
    nominated?: boolean;
  }>,
): { packetLoss: number; rttMs: number; jitterMs: number } {
  let lost = 0;
  let received = 0;
  let jitter = 0;
  let rtt = 0;
  for (const row of stats) {
    if (row.type === "inbound-rtp" && row.kind === "audio") {
      lost += row.packetsLost ?? 0;
      received += row.packetsReceived ?? 0;
      jitter = Math.max(jitter, (row.jitter ?? 0) * 1000);
    }
    if (row.type === "candidate-pair" && (row.state === "succeeded" || row.nominated)) {
      if (typeof row.currentRoundTripTime === "number") {
        rtt = row.currentRoundTripTime * 1000;
      }
    }
  }
  const total = lost + received;
  return {
    packetLoss: total > 0 ? lost / total : 0,
    rttMs: rtt,
    jitterMs: jitter,
  };
}
