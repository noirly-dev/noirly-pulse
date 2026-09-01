export const qk = {
  me: ["me"] as const,
  workspaces: ["workspaces"] as const,
  workspace: (id: string) => ["workspace", id] as const,
  members: (workspaceId: string) => ["workspace", workspaceId, "members"] as const,
  conversations: (scope: string) => ["conversations", scope] as const,
  conversation: (id: string) => ["conversation", id] as const,
  messages: (conversationId: string, threadParentId: string | "root") =>
    ["messages", conversationId, threadParentId] as const,
  search: (workspaceId: string | "personal", q: string) => ["search", workspaceId, q] as const,
  notifications: ["notifications"] as const,
  channels: (workspaceId: string) => ["channels", workspaceId] as const,
  users: (q: string) => ["users", q] as const,
  call: (callId: string) => ["call", callId] as const,
  activeCall: (conversationId: string) => ["active-call", conversationId] as const,
};
