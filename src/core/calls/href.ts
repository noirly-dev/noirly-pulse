import type { ConversationKind } from "@/src/core/models/enums";

export function conversationHref(input: {
  conversationId: string;
  workspaceId: string | null;
  conversationKind?: ConversationKind | null;
  callId?: string | null;
}): string {
  const base =
    input.workspaceId && input.conversationKind !== "dm" && input.conversationKind !== "group_dm"
      ? `/w/${input.workspaceId}/channel/${input.conversationId}`
      : `/dm/${input.conversationId}`;
  if (!input.callId) return base;
  const params = new URLSearchParams({ call: input.callId });
  return `${base}?${params.toString()}`;
}
