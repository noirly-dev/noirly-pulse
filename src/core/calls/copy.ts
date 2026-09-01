import type { CallLogKind, CallType } from "@/src/core/models/enums";

export function callMediaLabel(type: CallType): string {
  return type === "video" ? "video call" : "voice call";
}

export function callLogContent(logKind: CallLogKind, type: CallType): string {
  const media = callMediaLabel(type);
  switch (logKind) {
    case "started":
      return `Started ${media}`;
    case "ended":
      return type === "video" ? "Video call" : "Voice call";
    case "missed":
      return `Missed ${media}`;
    case "cancelled":
      return `Cancelled ${media}`;
    case "declined":
      return `Declined ${media}`;
  }
}

export function formatCallDuration(seconds: number | null): string | null {
  if (seconds == null || seconds < 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
