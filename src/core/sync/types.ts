import type {
  Attachment,
  Conversation,
  ConversationSummary,
  Invite,
  Message,
  Notification,
  Reaction,
  ReadReceipt,
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceSummary,
} from "@/src/core/models/types";
import type { ChannelVisibility, ConversationKind, MemberRole } from "@/src/core/models/enums";

export type PageCursor = {
  before?: string;
  after?: string;
  anchorMessageId?: string;
  limit?: number;
};

export type MessagePage = {
  messages: Message[];
  nextCursor: string | null;
  prevCursor: string | null;
};

export interface PulseSyncProvider {
  getMe(): Promise<User>;
  heartbeat(): Promise<void>;

  listWorkspaces(): Promise<WorkspaceSummary[]>;
  createWorkspace(input: { name: string }): Promise<Workspace>;
  getWorkspace(id: string): Promise<Workspace & { role: MemberRole }>;
  updateWorkspace(id: string, input: { name?: string; slug?: string }): Promise<Workspace>;
  listMembers(workspaceId: string): Promise<Array<WorkspaceMember & { user: User }>>;
  updateMemberRole(workspaceId: string, userId: string, role: MemberRole): Promise<void>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
  createInvite(
    workspaceId: string,
    input: { email: string; role: Exclude<MemberRole, "owner"> },
  ): Promise<Invite>;

  listConversations(scope: {
    kind?: ConversationKind[];
    workspaceId?: string;
  }): Promise<ConversationSummary[]>;
  getConversation(id: string): Promise<ConversationSummary>;
  searchUsers(q: string): Promise<User[]>;
  createDm(userId: string): Promise<Conversation>;
  createGroupDm(input: { userIds: string[]; name?: string }): Promise<Conversation>;
  createChannel(input: {
    workspaceId: string;
    name: string;
    visibility: ChannelVisibility;
    topic?: string;
  }): Promise<Conversation>;
  updateChannel(
    id: string,
    input: { name?: string; topic?: string; visibility?: ChannelVisibility },
  ): Promise<Conversation>;
  archiveChannel(id: string): Promise<void>;
  addChannelMembers(conversationId: string, userIds: string[]): Promise<void>;
  removeChannelMember(conversationId: string, userId: string): Promise<void>;

  listMessages(
    conversationId: string,
    query: PageCursor & { threadParentId?: string | null },
  ): Promise<MessagePage>;
  sendMessage(input: {
    conversationId: string;
    content: string;
    clientNonce: string;
    attachmentIds?: string[];
    threadParentId?: string | null;
  }): Promise<Message>;
  editMessage(messageId: string, content: string): Promise<Message>;
  deleteMessage(messageId: string): Promise<Message>;

  toggleReaction(
    messageId: string,
    emoji: string,
  ): Promise<{ added: boolean; reaction: Reaction | null }>;
  markRead(conversationId: string, lastReadMessageId: string): Promise<ReadReceipt>;

  searchMessages(input: {
    q: string;
    workspaceId?: string;
    conversationId?: string;
    cursor?: string;
  }): Promise<{ hits: Array<Message & { conversation: Conversation }>; nextCursor: string | null }>;
  listNotifications(cursor?: string): Promise<{ items: Notification[]; nextCursor: string | null }>;
  markNotificationsRead(ids: string[]): Promise<void>;
  updatePreferences(input: {
    defaultNotificationPref?: import("@/src/core/models/enums").NotificationPref;
  }): Promise<User>;
  updateConversationNotifications(
    conversationId: string,
    notifications: import("@/src/core/models/enums").NotificationPref,
  ): Promise<void>;
  subscribePush(input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  }): Promise<void>;
  unsubscribePush(endpoint: string): Promise<void>;
  createUpload(file: {
    filename: string;
    mime: string;
    sizeBytes: number;
    body: Buffer;
  }): Promise<Attachment>;
}
