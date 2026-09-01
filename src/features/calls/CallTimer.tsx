"use client";

export function CallTimer({ startedAt, now }: { startedAt: number; now: number }) {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <p className="font-mono text-sm tabular-nums tracking-[0.08em] text-call-accent">
      {mins}:{secs.toString().padStart(2, "0")}
    </p>
  );
}
