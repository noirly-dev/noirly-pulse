"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { qk } from "@/src/core/sync/query-keys";
import { ChatView } from "@/src/features/chat/ChatView";
import { ThreadPanel } from "@/src/features/threads/ThreadPanel";
import { useCan } from "@/src/features/workspace/WorkspaceRoleContext";
import { api } from "@/src/lib/api-client";

type Props = {
  workspaceId: string;
  channelId: string;
  currentUserId: string;
  displayName: string;
  avatarUrl: string | null;
  threadId?: string | null;
};

export function ChannelChatPage({
  workspaceId,
  channelId,
  currentUserId,
  displayName,
  avatarUrl,
  threadId = null,
}: Props) {
  const router = useRouter();
  const canModerate = useCan("message.moderate");
  const { data } = useQuery({
    queryKey: qk.members(workspaceId),
    queryFn: () => api.listMembers(workspaceId),
  });
  const mentionCandidates = (data?.members ?? []).map((row) => row.user);

  function openThread(messageId: string) {
    if (window.matchMedia("(max-width: 768px)").matches) {
      router.push(`/w/${workspaceId}/channel/${channelId}/thread/${messageId}`);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("thread", messageId);
    router.push(url.pathname + url.search);
  }

  function closeThread() {
    router.push(`/w/${workspaceId}/channel/${channelId}`);
  }

  return (
    <div className="flex h-full min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatView
          conversationId={channelId}
          currentUserId={currentUserId}
          displayName={displayName}
          avatarUrl={avatarUrl}
          workspaceId={workspaceId}
          backHref={`/w/${workspaceId}`}
          mentionCandidates={mentionCandidates}
          onOpenThread={openThread}
          canModerate={canModerate}
        />
      </div>
      {threadId ? (
        <ThreadPanel
          conversationId={channelId}
          workspaceId={workspaceId}
          threadParentId={threadId}
          currentUserId={currentUserId}
          displayName={displayName}
          avatarUrl={avatarUrl}
          mentionCandidates={mentionCandidates}
          onClose={closeThread}
        />
      ) : null}
    </div>
  );
}
