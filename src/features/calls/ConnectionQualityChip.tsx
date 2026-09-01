"use client";

import type { ConnectionQuality } from "@/src/core/calls/stats";
import { cn } from "@/src/lib/cn";

const labels: Record<ConnectionQuality, string> = {
  good: "Good",
  ok: "Fair",
  poor: "Poor",
  unknown: "Connecting",
};

export function ConnectionQualityChip({ quality }: { quality: ConnectionQuality }) {
  return (
    <span
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.12em]",
        quality === "good" && "text-call-accent",
        quality === "ok" && "text-white/55",
        quality === "poor" && "text-call-warning",
        quality === "unknown" && "text-white/40",
      )}
      title="Connection quality from WebRTC packet loss and RTT"
    >
      {labels[quality]}
    </span>
  );
}
