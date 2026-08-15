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

export const NOTIFICATION_KINDS = ["mention", "dm", "thread_reply"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_PREFS = ["all", "mentions", "none"] as const;
export type NotificationPref = (typeof NOTIFICATION_PREFS)[number];
