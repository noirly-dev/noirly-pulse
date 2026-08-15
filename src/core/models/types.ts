import type {
  AttachmentKind,
  ChannelVisibility,
  ConversationKind,
  MemberRole,
  MessageStatus,
  NotificationKind,
  NotificationPref,
  WorkspaceKind,
} from "./enums";

export interface User {
  id: string;
  identitySub: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: string | null;
  defaultNotificationPref: NotificationPref;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  kind: WorkspaceKind;
  name: string;
  slug: string;
  ownerUserId: string;
  iconUrl: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: MemberRole;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  kind: ConversationKind;
  workspaceId: string | null;
  name: string | null;
  slug: string | null;
  topic: string | null;
  visibility: ChannelVisibility | null;
  dmKey: string | null;
  archivedAt: string | null;
  createdById: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Channel = Conversation & {
  kind: "channel";
  workspaceId: string;
  name: string;
  slug: string;
  visibility: ChannelVisibility;
  dmKey: null;
};

export type DirectMessage = Conversation & {
  kind: "dm";
  workspaceId: null;
  visibility: null;
  dmKey: string;
};

export type GroupDirectMessage = Conversation & {
  kind: "group_dm";
  workspaceId: null;
  visibility: null;
  dmKey: null;
};

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  mutedUntil: string | null;
  notifications: NotificationPref;
}

export type ChannelMember = ConversationMember;

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  filename: string;
  mime: string;
  sizeBytes: number;
  url: string;
  width: number | null;
  height: number | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  mentionedUserIds: string[];
  attachments: Attachment[];
  threadParentId: string | null;
  replyCount: number;
  lastReplyAt: string | null;
  clientNonce: string;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reactions: Array<{ emoji: string; userIds: string[] }>;
  localStatus?: MessageStatus;
}

export interface OptimisticMessage extends Message {
  localStatus: MessageStatus;
}

export interface Reaction {
  id: string;
  messageId: string;
  conversationId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface ReadReceipt {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  timestamp: string;
}

export interface TypingState {
  conversationId: string;
  userId: string;
  threadParentId: string | null;
  startedAt: number;
  expiresAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  workspaceId: string | null;
  conversationId: string;
  messageId: string;
  actorId: string;
  readAt: string | null;
  createdAt: string;
}

export interface Invite {
  id: string;
  workspaceId: string;
  email: string;
  role: Exclude<MemberRole, "owner">;
  tokenHash: string;
  invitedById: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export type WorkspaceSummary = Workspace & {
  role: MemberRole;
  unreadCount: number;
};

export type ConversationPeer = User & {
  lastReadMessageId: string | null;
  lastReadAt: string | null;
};

export type ConversationSummary = Conversation & {
  unreadCount: number;
  members: ConversationPeer[];
};
