export const WORKSPACE_KINDS = ["personal", "team"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export const MEMBER_ROLES = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const CONVERSATION_KINDS = ["dm", "group_dm", "channel"] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];

export const CHANNEL_VISIBILITIES = ["public", "private"] as const;
export type ChannelVisibility = (typeof CHANNEL_VISIBILITIES)[number];

export const MESSAGE_STATUSES = ["sending", "sent", "failed"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const ATTACHMENT_KINDS = ["image", "file"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const NOTIFICATION_KINDS = [
  "mention",
  "dm",
  "thread_reply",
  "incoming_call",
  "missed_call",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_PREFS = ["all", "mentions", "none"] as const;
export type NotificationPref = (typeof NOTIFICATION_PREFS)[number];

export const CALL_TYPES = ["audio", "video"] as const;
export type CallType = (typeof CALL_TYPES)[number];

export const CALL_STATUSES = [
  "ringing",
  "connecting",
  "active",
  "ended",
  "missed",
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const LIVE_CALL_STATUSES = ["ringing", "connecting", "active"] as const;
export type LiveCallStatus = (typeof LIVE_CALL_STATUSES)[number];

export const CALL_MEDIA_PATHS = ["p2p", "sfu"] as const;
export type CallMediaPath = (typeof CALL_MEDIA_PATHS)[number];

export const CALL_END_REASONS = [
  "hangup",
  "declined",
  "timeout",
  "failed",
  "replaced",
] as const;
export type CallEndReason = (typeof CALL_END_REASONS)[number];

export const MESSAGE_KINDS = ["user", "call_log"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const CALL_LOG_KINDS = [
  "started",
  "ended",
  "missed",
  "cancelled",
  "declined",
] as const;
export type CallLogKind = (typeof CALL_LOG_KINDS)[number];
