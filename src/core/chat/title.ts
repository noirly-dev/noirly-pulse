import type { ConversationSummary } from "@/src/core/models/types";

export function conversationTitle(conversation: ConversationSummary, meId: string): string {
  if (conversation.name?.trim()) return conversation.name.trim();
  const others = conversation.members.filter((member) => member.id !== meId);
  if (others.length === 0) return "You";
  return others.map((member) => member.displayName).join(", ");
}

export function clientNonce(): string {
  return crypto.randomUUID();
}
