"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/src/core/models/types";
import { ChatView } from "@/src/features/chat/ChatView";
import { ThreadPanel } from "@/src/features/threads/ThreadPanel";

type Props = {
  conversationId: string;
  /** Conversation URL without query, e.g. `/dm/{id}` or `/w/{ws}/channel/{id}`. */
  basePath: string;
  backHref: string;
  workspaceId?: string;
  currentUserId: string;
  displayName: string;
  avatarUrl: string | null;
  threadId?: string | null;
  mentionCandidates?: User[];
  canModerate?: boolean;
};

/**
 * Conversation + Slack-style thread panel (§11.3). Desktop keeps the thread in
 * `?thread=` (replace, not push); narrow viewports navigate to `/thread/{id}`.
 */
export function ChatWithThreads({
  conversationId,
  basePath,
  backHref,
  workspaceId,
  currentUserId,
  displayName,
  avatarUrl,
  threadId = null,
  mentionCandidates = [],
  canModerate = false,
}: Props) {
  const router = useRouter();

  const openThread = useCallback(
    (messageId: string) => {
      if (window.matchMedia("(max-width: 768px)").matches) {
        router.push(`${basePath}/thread/${messageId}`);
        return;
      }
      router.replace(`${basePath}?thread=${messageId}`, { scroll: false });
    },
    [router, basePath],
  );

  const closeThread = useCallback(() => {
    router.replace(basePath, { scroll: false });
  }, [router, basePath]);

  return (
    <div className="flex h-full min-h-0 flex-1">
      <div data-root-chat="" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatView
          conversationId={conversationId}
          currentUserId={currentUserId}
          displayName={displayName}
          avatarUrl={avatarUrl}
          workspaceId={workspaceId}
          backHref={backHref}
          mentionCandidates={mentionCandidates}
          onOpenThread={openThread}
          canModerate={canModerate}
        />
      </div>
      {threadId ? (
        <ThreadPanel
          conversationId={conversationId}
          workspaceId={workspaceId}
          threadParentId={threadId}
          currentUserId={currentUserId}
          displayName={displayName}
          avatarUrl={avatarUrl}
          mentionCandidates={mentionCandidates}
          backHref={basePath}
          onClose={closeThread}
        />
      ) : null}
    </div>
  );
}
