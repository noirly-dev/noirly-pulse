"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/src/core/sync/query-keys";
import { ChatWithThreads } from "@/src/features/threads/ChatWithThreads";
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
  const canModerate = useCan("message.moderate");
  const { data } = useQuery({
    queryKey: qk.members(workspaceId),
    queryFn: () => api.listMembers(workspaceId),
  });
  const mentionCandidates = (data?.members ?? [])
    .map((row) => row.user)
    .filter((user) => user.id !== currentUserId);

  return (
    <ChatWithThreads
      conversationId={channelId}
      basePath={`/w/${workspaceId}/channel/${channelId}`}
      backHref={`/w/${workspaceId}`}
      workspaceId={workspaceId}
      currentUserId={currentUserId}
      displayName={displayName}
      avatarUrl={avatarUrl}
      threadId={threadId}
      mentionCandidates={mentionCandidates}
      canModerate={canModerate}
    />
  );
}
