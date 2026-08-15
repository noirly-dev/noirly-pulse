import type { ChannelVisibility, ConversationKind } from "@/src/core/models/enums";

export type VisibilityInput = {
  kind: ConversationKind;
  visibility: ChannelVisibility | null;
  isWorkspaceMember: boolean;
  isConversationMember: boolean;
};

/** Slack-like: private channels are invite-only, even for workspace owners. */
export function canViewConversation(input: VisibilityInput): boolean {
  if (input.kind === "dm" || input.kind === "group_dm") {
    return input.isConversationMember;
  }

  if (!input.isWorkspaceMember) {
    return false;
  }

  if (input.visibility === "private") {
    return input.isConversationMember;
  }

  return true;
}

export function canSendInConversation(input: VisibilityInput): boolean {
  return canViewConversation(input);
}
