import type { NotificationKind, NotificationPref } from "@/src/core/models/enums";

/** Whether an in-app / push notification should fire for this kind and pref. */
export function shouldDeliverNotification(
  pref: NotificationPref,
  kind: NotificationKind,
): boolean {
  if (pref === "none") return false;
  if (pref === "mentions") {
    return kind === "mention" || kind === "dm" || kind === "thread_reply";
  }
  return true;
}

export function isConversationMuted(mutedUntil: string | null, now = Date.now()): boolean {
  if (!mutedUntil) return false;
  return new Date(mutedUntil).getTime() > now;
}
