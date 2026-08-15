import type {
  Attachment,
  Channel,
  ConversationSummary,
  Message,
  Notification,
  ReadReceipt,
  Reaction,
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceSummary,
} from "@/src/core/models/types";
import type { MessagePage } from "@/src/core/sync/types";

type ApiErrorBody = { error?: string; message?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...init, headers });
  const data = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok) {
    throw new Error(data.message || data.error || "Request failed");
  }
  return data;
}

export const api = {
  me() {
    return request<{
      user: Pick<
        User,
        | "id"
        | "email"
        | "displayName"
        | "identitySub"
        | "avatarUrl"
        | "lastSeenAt"
        | "defaultNotificationPref"
      >;
    }>("/api/me");
  },
  heartbeat() {
    return request<{ ok: boolean }>("/api/me/heartbeat", { method: "POST" });
  },
  listWorkspaces() {
    return request<{ workspaces: WorkspaceSummary[] }>("/api/workspaces");
  },
  createWorkspace(name: string) {
    return request<{ workspace: Workspace }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },
  getWorkspace(workspaceId: string) {
    return request<{ workspace: WorkspaceSummary }>(`/api/workspaces/${workspaceId}`);
  },
  updateWorkspace(workspaceId: string, body: { name?: string; slug?: string }) {
    return request<{ workspace: Workspace }>(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  listMembers(workspaceId: string) {
    return request<{ members: Array<WorkspaceMember & { user: User }> }>(
      `/api/workspaces/${workspaceId}/members`,
    );
  },
  inviteMember(workspaceId: string, email: string, role: "admin" | "member") {
    return request<{ invite: { id: string; email: string; role: string } }>(
      `/api/workspaces/${workspaceId}/members`,
      { method: "POST", body: JSON.stringify({ email, role }) },
    );
  },
  updateMemberRole(workspaceId: string, userId: string, role: "admin" | "member") {
    return request<{ ok: boolean }>(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },
  removeMember(workspaceId: string, userId: string) {
    return request<{ ok: boolean }>(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: "DELETE",
    });
  },
  listChannels(workspaceId: string) {
    return request<{ channels: ConversationSummary[] }>(
      `/api/workspaces/${workspaceId}/channels`,
    );
  },
  createChannel(
    workspaceId: string,
    body: { name: string; visibility: "public" | "private"; topic?: string },
  ) {
    return request<{ channel: Channel }>(`/api/workspaces/${workspaceId}/channels`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  addChannelMembers(conversationId: string, userIds: string[]) {
    return request<{ ok: boolean }>(`/api/conversations/${conversationId}/members`, {
      method: "POST",
      body: JSON.stringify({ userIds }),
    });
  },
  searchMessages(query: {
    q: string;
    workspaceId?: string;
    conversationId?: string;
    cursor?: string;
  }) {
    const params = new URLSearchParams({ q: query.q });
    if (query.workspaceId) params.set("workspaceId", query.workspaceId);
    if (query.conversationId) params.set("conversationId", query.conversationId);
    if (query.cursor) params.set("cursor", query.cursor);
    return request<{
      hits: Array<Message & { conversation: ConversationSummary }>;
      nextCursor: string | null;
    }>(`/api/search?${params.toString()}`);
  },
  listNotifications(cursor?: string) {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return request<{ items: Notification[]; nextCursor: string | null }>(
      `/api/notifications${qs}`,
    );
  },
  markNotificationsRead(ids: string[]) {
    return request<{ ok: boolean }>("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ ids }),
    });
  },
  updatePreferences(body: { defaultNotificationPref?: "all" | "mentions" | "none" }) {
    return request<{ user: User }>("/api/me/preferences", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  updateConversationNotifications(
    conversationId: string,
    notifications: "all" | "mentions" | "none",
  ) {
    return request<{ ok: boolean }>(`/api/conversations/${conversationId}/preferences`, {
      method: "PATCH",
      body: JSON.stringify({ notifications }),
    });
  },
  pushVapidKey() {
    return request<{ publicKey: string | null }>("/api/push/vapid");
  },
  subscribePush(subscription: PushSubscriptionJSON) {
    return request<{ ok: boolean }>("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      }),
    });
  },
  unsubscribePush(endpoint: string) {
    return request<{ ok: boolean }>("/api/push/subscribe", {
      method: "DELETE",
      body: JSON.stringify({ endpoint }),
    });
  },
  searchUsers(q: string) {
    return request<{ users: User[] }>(`/api/users?q=${encodeURIComponent(q)}`);
  },
  listConversations() {
    return request<{ conversations: ConversationSummary[] }>("/api/conversations");
  },
  getConversation(conversationId: string) {
    return request<{ conversation: ConversationSummary }>(
      `/api/conversations/${conversationId}`,
    );
  },
  createDm(userId: string) {
    return request<{ conversation: ConversationSummary }>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ kind: "dm", userId }),
    });
  },
  createGroupDm(userIds: string[], name?: string) {
    return request<{ conversation: ConversationSummary }>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ kind: "group_dm", userIds, name }),
    });
  },
  listMessages(
    conversationId: string,
    query: {
      before?: string;
      after?: string;
      anchorMessageId?: string;
      limit?: number;
      threadParentId?: string | null;
    } = {},
  ) {
    const params = new URLSearchParams();
    if (query.before) params.set("before", query.before);
    if (query.after) params.set("after", query.after);
    if (query.anchorMessageId) params.set("anchorMessageId", query.anchorMessageId);
    if (query.limit) params.set("limit", String(query.limit));
    if (query.threadParentId) params.set("threadParentId", query.threadParentId);
    const qs = params.toString();
    return request<MessagePage>(
      `/api/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`,
    );
  },
  sendMessage(
    conversationId: string,
    body: {
      content: string;
      clientNonce: string;
      attachmentIds?: string[];
      threadParentId?: string | null;
    },
  ) {
    return request<{ message: Message }>(
      `/api/conversations/${conversationId}/messages`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },
  editMessage(messageId: string, content: string) {
    return request<{ message: Message }>(`/api/messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    });
  },
  deleteMessage(messageId: string) {
    return request<{ message: Message }>(`/api/messages/${messageId}`, {
      method: "DELETE",
    });
  },
  toggleReaction(messageId: string, emoji: string) {
    return request<{ added: boolean; reaction: Reaction | null }>(
      `/api/messages/${messageId}/reactions`,
      { method: "POST", body: JSON.stringify({ emoji }) },
    );
  },
  markRead(conversationId: string, lastReadMessageId: string) {
    return request<{ receipt: ReadReceipt }>(
      `/api/conversations/${conversationId}/read`,
      { method: "PUT", body: JSON.stringify({ lastReadMessageId }) },
    );
  },
  upload(file: File) {
    const body = new FormData();
    body.append("file", file);
    return request<{ attachment: Attachment }>("/api/uploads", {
      method: "POST",
      body,
    });
  },
};
