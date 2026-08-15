"use client";

import { useQuery } from "@tanstack/react-query";
import type { User } from "@/src/core/models/types";
import { qk } from "@/src/core/sync/query-keys";
import { ChatView } from "@/src/features/chat/ChatView";
import { api } from "@/src/lib/api-client";
import { IconButton } from "@/src/ui/IconButton";

type Props = {
  conversationId: string;
  workspaceId: string;
  threadParentId: string;
  currentUserId: string;
  displayName: string;
  avatarUrl: string | null;
  mentionCandidates: User[];
  onClose: () => void;
};

export function ThreadPanel({
  conversationId,
  workspaceId,
  threadParentId,
  currentUserId,
  displayName,
  avatarUrl,
  mentionCandidates,
  onClose,
}: Props) {
  const { data } = useQuery({
    queryKey: qk.conversation(conversationId),
    queryFn: () => api.getConversation(conversationId),
  });

  return (
    <aside className="hidden w-[min(420px,40%)] shrink-0 flex-col border-l border-np-border bg-np-bg md:flex">
      <div className="flex items-center justify-between border-b border-np-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Thread</p>
          <p className="text-xs text-[#737373]">#{data?.conversation.name ?? "channel"}</p>
        </div>
        <IconButton label="Close thread" onClick={onClose}>
          ×
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatView
          conversationId={conversationId}
          currentUserId={currentUserId}
          displayName={displayName}
          avatarUrl={avatarUrl}
          threadParentId={threadParentId}
          workspaceId={workspaceId}
          backHref={`/w/${workspaceId}/channel/${conversationId}`}
          mentionCandidates={mentionCandidates}
        />
      </div>
    </aside>
  );
}
