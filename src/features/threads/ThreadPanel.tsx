"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { User } from "@/src/core/models/types";
import { conversationTitle } from "@/src/core/chat/title";
import { qk } from "@/src/core/sync/query-keys";
import { ChatView } from "@/src/features/chat/ChatView";
import { api } from "@/src/lib/api-client";
import { IconButton } from "@/src/components/IconButton";

type Props = {
  conversationId: string;
  workspaceId?: string;
  threadParentId: string;
  currentUserId: string;
  displayName: string;
  avatarUrl: string | null;
  mentionCandidates: User[];
  backHref: string;
  onClose: () => void;
};

/** Desktop side panel (§11.3). Not a dialog: `aria-modal` stays false. */
export function ThreadPanel({
  conversationId,
  workspaceId,
  threadParentId,
  currentUserId,
  displayName,
  avatarUrl,
  mentionCandidates,
  backHref,
  onClose,
}: Props) {
  const panel = useRef<HTMLElement>(null);
  const { data } = useQuery({
    queryKey: qk.conversation(conversationId),
    queryFn: () => api.getConversation(conversationId),
  });
  const conversation = data?.conversation;
  const label = conversation
    ? conversation.kind === "channel"
      ? `#${conversation.name ?? conversation.slug}`
      : conversationTitle(conversation, currentUserId)
    : "";

  // Focus the thread composer on open; restore focus to the root composer on close.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      panel.current?.querySelector<HTMLTextAreaElement>("textarea[data-composer]")?.focus();
    });
    return () => {
      window.cancelAnimationFrame(id);
      document
        .querySelector<HTMLTextAreaElement>("[data-root-chat] textarea[data-composer]")
        ?.focus();
    };
  }, [threadParentId]);

  // Esc closes the panel unless something stacked above it (picker, dialog) handled it.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      ref={panel}
      aria-label="Thread"
      aria-modal="false"
      className="hidden w-[min(420px,40%)] shrink-0 flex-col border-l border-[var(--hairline)] bg-background md:flex"
    >
      <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Thread</p>
          <p className="text-xs text-muted-foreground">{label}</p>
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
          backHref={backHref}
          mentionCandidates={mentionCandidates}
          realtime={false}
        />
      </div>
    </aside>
  );
}
