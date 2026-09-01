import type { Types } from "mongoose";
import type { ChannelVisibility, ConversationKind, MemberRole } from "@/src/core/models/enums";
import type {
  Attachment,
  Call,
  CallLogPayload,
  CallParticipant,
  Conversation,
  Invite,
  Message,
  Notification,
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceSummary,
} from "@/src/core/models/types";

function iso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

export function mapUser(doc: {
  _id: Types.ObjectId;
  identitySub: string;
  email: string;
  emailVerified?: boolean;
  displayName: string;
  avatarUrl?: string | null;
  lastSeenAt?: Date | null;
  defaultNotificationPref?: string;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: doc._id.toString(),
    identitySub: doc.identitySub,
    email: doc.email,
    emailVerified: Boolean(doc.emailVerified),
    displayName: doc.displayName,
    avatarUrl: doc.avatarUrl ?? null,
    lastSeenAt: iso(doc.lastSeenAt),
    defaultNotificationPref:
      (doc.defaultNotificationPref as User["defaultNotificationPref"]) ?? "all",
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function mapWorkspace(doc: {
  _id: Types.ObjectId;
  kind: Workspace["kind"];
  name: string;
  slug: string;
  ownerUserId: Types.ObjectId;
  iconUrl?: string | null;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Workspace {
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    name: doc.name,
    slug: doc.slug,
    ownerUserId: doc.ownerUserId.toString(),
    iconUrl: doc.iconUrl ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    archivedAt: iso(doc.archivedAt),
  };
}

export function mapWorkspaceSummary(
  doc: Parameters<typeof mapWorkspace>[0],
  role: MemberRole,
  unreadCount = 0,
): WorkspaceSummary {
  return { ...mapWorkspace(doc), role, unreadCount };
}

export function mapConversation(doc: {
  _id: Types.ObjectId;
  kind: ConversationKind;
  workspaceId?: Types.ObjectId | null;
  name?: string | null;
  slug?: string | null;
  topic?: string | null;
  visibility?: ChannelVisibility | null;
  dmKey?: string | null;
  archivedAt?: Date | null;
  createdById: Types.ObjectId;
  lastMessageAt?: Date | null;
  lastMessagePreview?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Conversation {
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    workspaceId: doc.workspaceId ? doc.workspaceId.toString() : null,
    name: doc.name ?? null,
    slug: doc.slug ?? null,
    topic: doc.topic ?? null,
    visibility: doc.visibility ?? null,
    dmKey: doc.dmKey ?? null,
    archivedAt: iso(doc.archivedAt),
    createdById: doc.createdById.toString(),
    lastMessageAt: iso(doc.lastMessageAt),
    lastMessagePreview: doc.lastMessagePreview ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function mapAttachment(doc: {
  id: string;
  kind: Attachment["kind"];
  filename: string;
  mime: string;
  sizeBytes: number;
  url: string;
  width?: number | null;
  height?: number | null;
}): Attachment {
  return {
    id: doc.id,
    kind: doc.kind,
    filename: doc.filename,
    mime: doc.mime,
    sizeBytes: doc.sizeBytes,
    url: doc.url,
    width: doc.width ?? null,
    height: doc.height ?? null,
  };
}

export function mapWorkspaceMember(doc: {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  role: WorkspaceMember["role"];
  createdAt: Date;
  updatedAt: Date;
}): WorkspaceMember {
  return {
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    userId: doc.userId.toString(),
    role: doc.role,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function mapInvite(doc: {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  email: string;
  role: Invite["role"];
  tokenHash: string;
  invitedById: Types.ObjectId;
  expiresAt: Date;
  acceptedAt?: Date | null;
  createdAt: Date;
}): Invite {
  return {
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    email: doc.email,
    role: doc.role,
    tokenHash: doc.tokenHash,
    invitedById: doc.invitedById.toString(),
    expiresAt: doc.expiresAt.toISOString(),
    acceptedAt: iso(doc.acceptedAt),
    createdAt: doc.createdAt.toISOString(),
  };
}

export function mapNotification(doc: {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  kind: Notification["kind"];
  workspaceId?: Types.ObjectId | null;
  conversationId: Types.ObjectId;
  messageId?: Types.ObjectId | null;
  actorId: Types.ObjectId;
  readAt?: Date | null;
  createdAt: Date;
}): Notification {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    kind: doc.kind,
    workspaceId: doc.workspaceId ? doc.workspaceId.toString() : null,
    conversationId: doc.conversationId.toString(),
    messageId: doc.messageId ? doc.messageId.toString() : null,
    actorId: doc.actorId.toString(),
    readAt: iso(doc.readAt),
    createdAt: doc.createdAt.toISOString(),
  };
}

export function mapCallLog(doc: {
  callId: Types.ObjectId;
  logKind: CallLogPayload["logKind"];
  type: CallLogPayload["type"];
  durationSeconds?: number | null;
  initiatedBy: Types.ObjectId;
  mediaPath: CallLogPayload["mediaPath"];
}): CallLogPayload {
  return {
    callId: doc.callId.toString(),
    logKind: doc.logKind,
    type: doc.type,
    durationSeconds: doc.durationSeconds ?? null,
    initiatedBy: doc.initiatedBy.toString(),
    mediaPath: doc.mediaPath,
  };
}

export function mapMessage(doc: {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  kind?: Message["kind"] | null;
  content?: string | null;
  callLog?: Parameters<typeof mapCallLog>[0] | null;
  mentionedUserIds?: Types.ObjectId[];
  attachments?: Array<Parameters<typeof mapAttachment>[0]>;
  threadParentId?: Types.ObjectId | null;
  replyCount?: number;
  lastReplyAt?: Date | null;
  clientNonce: string;
  editedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Message {
  const deleted = Boolean(doc.deletedAt);
  return {
    id: doc._id.toString(),
    conversationId: doc.conversationId.toString(),
    senderId: doc.senderId.toString(),
    kind: doc.kind ?? "user",
    content: deleted ? "" : (doc.content ?? ""),
    callLog: deleted || !doc.callLog ? null : mapCallLog(doc.callLog),
    mentionedUserIds: (doc.mentionedUserIds ?? []).map((id) => id.toString()),
    attachments: deleted ? [] : (doc.attachments ?? []).map(mapAttachment),
    threadParentId: doc.threadParentId ? doc.threadParentId.toString() : null,
    replyCount: doc.replyCount ?? 0,
    lastReplyAt: iso(doc.lastReplyAt),
    clientNonce: doc.clientNonce,
    editedAt: iso(doc.editedAt),
    deletedAt: iso(doc.deletedAt),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    reactions: [],
  };
}

export function mapCall(doc: {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  workspaceId?: Types.ObjectId | null;
  initiatedBy: Types.ObjectId;
  type: Call["type"];
  status: Call["status"];
  mediaPath: Call["mediaPath"];
  presenterUserId?: Types.ObjectId | null;
  recording?: boolean;
  startedAt?: Date | null;
  endedAt?: Date | null;
  endReason?: Call["endReason"];
  ringTimeoutMs?: number;
  clientNonce: string;
  createdAt: Date;
  updatedAt: Date;
}): Call {
  return {
    id: doc._id.toString(),
    conversationId: doc.conversationId.toString(),
    workspaceId: doc.workspaceId ? doc.workspaceId.toString() : null,
    initiatedBy: doc.initiatedBy.toString(),
    type: doc.type,
    status: doc.status,
    mediaPath: doc.mediaPath,
    presenterUserId: doc.presenterUserId ? doc.presenterUserId.toString() : null,
    recording: Boolean(doc.recording),
    startedAt: iso(doc.startedAt),
    endedAt: iso(doc.endedAt),
    endReason: doc.endReason ?? null,
    ringTimeoutMs: doc.ringTimeoutMs ?? 30_000,
    clientNonce: doc.clientNonce,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function mapCallParticipant(doc: {
  _id: Types.ObjectId;
  callId: Types.ObjectId;
  userId: Types.ObjectId;
  joinedAt?: Date | null;
  leftAt?: Date | null;
  isMuted?: boolean;
  isVideoOn?: boolean;
  isPresenting?: boolean;
  handRaised?: boolean;
  role: CallParticipant["role"];
  createdAt: Date;
  updatedAt: Date;
}): CallParticipant {
  return {
    id: doc._id.toString(),
    callId: doc.callId.toString(),
    userId: doc.userId.toString(),
    joinedAt: iso(doc.joinedAt),
    leftAt: iso(doc.leftAt),
    isMuted: Boolean(doc.isMuted),
    isVideoOn: Boolean(doc.isVideoOn),
    isPresenting: Boolean(doc.isPresenting),
    handRaised: Boolean(doc.handRaised),
    role: doc.role,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
