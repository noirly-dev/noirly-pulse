"use client";

import { formatCallDuration, callLogContent } from "@/src/core/calls/copy";
import type { CallLogPayload } from "@/src/core/models/types";

export function CallLogBubble({
  content,
  callLog,
  createdAt,
}: {
  content: string;
  callLog: CallLogPayload | null;
  createdAt: string;
}) {
  const duration = formatCallDuration(callLog?.durationSeconds ?? null);
  const label = callLog ? callLogContent(callLog.logKind, callLog.type) : content;

  return (
    <div className="flex justify-center px-4 py-2">
      <div className="max-w-[min(72%,28rem)] border border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-center">
        <p className="text-sm text-foreground">{label}</p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          {duration ? `${duration} · ` : ""}
          {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
