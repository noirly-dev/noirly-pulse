"use client";

import { ChannelSidebar } from "@/src/features/channels/ChannelSidebar";
import { DmSidebar } from "@/src/features/shell/DmSidebar";

type Props = {
  mode: "personal" | "workspace";
  workspaceId?: string;
  currentUserId: string;
  onNavigate?: () => void;
};

export function ConversationSidebar({
  mode,
  workspaceId,
  currentUserId,
  onNavigate,
}: Props) {
  if (mode === "workspace" && workspaceId) {
    return <ChannelSidebar workspaceId={workspaceId} onNavigate={onNavigate} />;
  }
  return <DmSidebar currentUserId={currentUserId} onNavigate={onNavigate} />;
}
