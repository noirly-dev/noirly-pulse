"use client";

import { useRealtimeClient } from "@noirly-dev/realtime-client/react";
import { usePresence } from "@noirly-dev/realtime-client/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ConversationSummary, Message, TypingState, User } from "@/src/core/models/types";
import { renderMarkdownToSafeHtml } from "@/src/core/markdown/sanitize";
import { PresenceAvatars } from "@/src/features/channels/PresenceAvatars";
import { ChannelCallBanner } from "@/src/features/calls/ChannelCallBanner";
import { StartCallButtons } from "@/src/features/calls/StartCallButtons";
import { conversationTitle, clientNonce } from "@/src/core/chat/title";
import { pulseChannel } from "@/src/core/realtime/channels";
import { appendMessage, markFailed, replaceNonce, type MessagesInfinite } from "@/src/core/sync/message-cache";
import { qk } from "@/src/core/sync/query-keys";
import { MessageList } from "@/src/features/chat/MessageList";
import { MessageComposer } from "@/src/features/composer/MessageComposer";
import { ConversationRealtime } from "@/src/features/realtime/ConversationRealtime";
import { api } from "@/src/lib/api-client";
import { useTypingStore, useUnreadStore } from "@/src/stores/ui-store";
import { Avatar } from "@/src/components/Avatar";
import { EmptyState } from "@/src/components/EmptyState";
import { useReadReceipts } from "@/src/features/chat/useReadReceipts";
import { lastSeenLabel } from "@/src/core/chat/last-seen";

/** Stable fallback: a fresh `{}` per selector call makes Zustand re-render forever. */
const NO_TYPERS: Record<string, TypingState> = {};

type Props = {
  conversationId: string;
  currentUserId: string;
  displayName: string;
  avatarUrl: string | null;
  threadParentId?: string | null;
  workspaceId?: string;
  backHref?: string;
  mentionCandidates?: User[];
  onOpenThread?: (messageId: string) => void;
  canModerate?: boolean;
  /**
   * Rendered inside a thread side panel: the parent view already owns the
   * header and the realtime subscription.
   */
  embedded?: boolean;
};

export function ChatView({
  conversationId,
  currentUserId,
  displayName,
  avatarUrl,
  threadParentId = null,
  workspaceId,
  backHref = "/inbox",
  mentionCandidates = [],
  onOpenThread,
  canModerate = false,
  embedded = false,
}: Props) {
  const searchParams = useSearchParams();
  const highlightMessageId = searchParams.get("msg");
  const queryClient = useQueryClient();
  const realtimeEnabled = Boolean(process.env.NEXT_PUBLIC_REALTIME_WS_URL);
  const [lastOwnMessageId, setLastOwnMessageId] = useState<string | null>(null);
  const { noteRead, flush } = useReadReceipts(conversationId);
  // Receipts track the root timeline; thread panels do not move the pointer.
  const onReadable = useCallback(
    (messageId: string) => {
      if (!threadParentId) noteRead(messageId);
    },
    [noteRead, threadParentId],
  );
  const { data, isError } = useQuery({
    queryKey: qk.conversation(conversationId),
    queryFn: () => api.getConversation(conversationId),
  });
  const conversation = data?.conversation;
  const title = conversation ? conversationTitle(conversation, currentUserId) : "Conversation";
  const typing = useTypingStore((s) => s.byConv[conversationId] ?? NO_TYPERS);
  const typers = Object.values(typing).filter(
    (row) =>
      row.userId !== currentUserId &&
      (row.threadParentId ?? null) === (threadParentId ?? null),
  );
  const names = typers.map(
    (row) => conversation?.members.find((m) => m.id === row.userId)?.displayName ?? "Someone",
  );

  useEffect(() => {
    useUnreadStore.getState().clear(conversationId);
  }, [conversationId]);

  // Cmd/Ctrl+Shift+A: mark this conversation read now (§11.7).
  useEffect(() => {
    if (threadParentId) return;
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
      if (event.key.toLowerCase() !== "a") return;
      event.preventDefault();
      const data = queryClient.getQueryData<MessagesInfinite>(qk.messages(conversationId, "root"));
      const newest = data?.pages[0]?.messages.filter((m) => !m.id.startsWith("tmp-")).at(-1);
      if (newest) {
        noteRead(newest.id);
        flush();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [conversationId, threadParentId, queryClient, noteRead, flush]);

  if (isError) {
    return (
      <EmptyState
        title="Conversation not found"
        description="It may have been removed, or you do not have access."
      />
    );
  }

  if (!conversation) {
    return <EmptyState title="Loading" description="Opening conversation…" />;
  }

  const isChannel = conversation?.kind === "channel";
  const channelLabel = isChannel ? `#${conversation.name ?? conversation.slug}` : title;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {realtimeEnabled && !embedded ? (
        <ConversationRealtime
          conversationId={conversationId}
          currentUserId={currentUserId}
          displayName={displayName}
          avatarUrl={avatarUrl}
        />
      ) : null}
      <header hidden={embedded} className="flex items-center gap-3 border-b border border-[var(--hairline)] px-4 py-3 sm:px-6">
        <Link href={backHref} className="text-sm text-muted-foreground md:hidden">
          Back
        </Link>
        {!isChannel ? (
          <Avatar
            name={title}
            src={conversation.members.find((m) => m.id !== currentUserId)?.avatarUrl}
            size="sm"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{channelLabel}</h1>
          {conversation.topic ? (
            <p className="truncate text-xs text-muted-foreground">{conversation.topic}</p>
          ) : realtimeEnabled ? (
            <PresenceLine
              conversationId={conversationId}
              lastSeenAt={
                conversation.kind === "dm"
                  ? (conversation.members.find((m) => m.id !== currentUserId)?.lastSeenAt ?? null)
                  : null
              }
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              {isChannel ? "Channel" : "Direct message"}
            </p>
          )}
        </div>
        {realtimeEnabled && isChannel ? (
          <PresenceAvatars conversationId={conversationId} />
        ) : null}
        {(conversation.kind === "dm" ||
          conversation.kind === "group_dm" ||
          conversation.kind === "channel") &&
        !threadParentId ? (
          <StartCallButtons
            conversationId={conversationId}
            peerName={title}
            peerUserId={
              conversation.kind === "dm"
                ? conversation.members.find((m) => m.id !== currentUserId)?.id
                : undefined
            }
            peerAvatarUrl={
              conversation.kind === "dm"
                ? conversation.members.find((m) => m.id !== currentUserId)?.avatarUrl
                : undefined
            }
            currentUserId={currentUserId}
            conversationKind={conversation.kind}
            canModerate={canModerate}
            workspaceId={conversation.workspaceId}
          />
        ) : null}
      </header>
      {realtimeEnabled ? (
        <ChannelCallBanner
          conversationId={conversationId}
          currentUserId={currentUserId}
          canModerate={canModerate}
          conversationKind={conversation.kind}
        />
      ) : null}
      {threadParentId ? (
        <ThreadParent
          conversationId={conversationId}
          threadParentId={threadParentId}
          members={conversation.members}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col">
        <MessageList
          conversation={conversation}
          currentUserId={currentUserId}
          threadParentId={threadParentId}
          highlightMessageId={highlightMessageId}
          canModerate={canModerate}
          onOpenThread={onOpenThread}
          onReadable={onReadable}
          onLastOwnChange={setLastOwnMessageId}
        />
        {names.length > 0 ? (
          <p className="px-4 pb-2 text-xs text-muted-foreground" aria-live="polite">
            {names.slice(0, 3).join(", ")}
            {names.length > 3 ? ` and ${names.length - 3} more` : ""} typing
            <span className="ml-1 inline-flex gap-0.5" aria-hidden>
              <span className="animate-pulse">.</span>
              <span className="animate-pulse [animation-delay:150ms]">.</span>
              <span className="animate-pulse [animation-delay:300ms]">.</span>
            </span>
          </p>
        ) : null}
      </div>
      <ComposerWithRealtime
        conversationId={conversationId}
        currentUserId={currentUserId}
        displayName={displayName}
        realtimeEnabled={realtimeEnabled}
        threadParentId={threadParentId}
        lastOwnMessageId={lastOwnMessageId}
        mentionCandidates={
          mentionCandidates.length > 0
            ? mentionCandidates
            : conversation.members.filter((m) => m.id !== currentUserId)
        }
        onSend={async (content, files) => {
          const attachments = [];
          for (const file of files) {
            const { attachment } = await api.upload(file);
            attachments.push(attachment);
          }
          const nonce = clientNonce();
          const optimistic: Message = {
            id: `tmp-${nonce}`,
            conversationId,
            senderId: currentUserId,
            kind: "user",
            content,
            callLog: null,
            mentionedUserIds: [],
            attachments,
            threadParentId,
            replyCount: 0,
            lastReplyAt: null,
            clientNonce: nonce,
            editedAt: null,
            deletedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            reactions: [],
            localStatus: "sending",
          };
          const threadKey = threadParentId ?? "root";
          queryClient.setQueryData<MessagesInfinite>(
            qk.messages(conversationId, threadKey),
            (old) => appendMessageForKey(old, optimistic),
          );
          try {
            const { message } = await api.sendMessage(conversationId, {
              content,
              clientNonce: nonce,
              attachmentIds: attachments.map((a) => a.id),
              threadParentId,
            });
            queryClient.setQueryData<MessagesInfinite>(
              qk.messages(conversationId, threadKey),
              (old) => replaceNonce(old, nonce, message),
            );
            if (workspaceId) {
              void queryClient.invalidateQueries({ queryKey: qk.channels(workspaceId) });
            } else {
              void queryClient.invalidateQueries({ queryKey: qk.conversations("personal") });
            }
          } catch {
            queryClient.setQueryData<MessagesInfinite>(
              qk.messages(conversationId, threadKey),
              (old) => markFailed(old, nonce),
            );
          }
        }}
      />
    </div>
  );
}

/** The message a thread hangs off, pinned above the replies. */
function ThreadParent({
  conversationId,
  threadParentId,
  members,
}: {
  conversationId: string;
  threadParentId: string;
  members: ConversationSummary["members"];
}) {
  // Shaped like the message lists and keyed under ["messages", conv] so the
  // realtime patchers (edit, delete, thread.updated) keep it current.
  const { data } = useQuery({
    queryKey: ["messages", conversationId, `parent:${threadParentId}`],
    queryFn: async (): Promise<MessagesInfinite> => {
      const page = await api.listMessages(conversationId, {
        anchorMessageId: threadParentId,
        limit: 1,
      });
      return { pages: [page], pageParams: [undefined] };
    },
    staleTime: Infinity,
  });
  const parent = data?.pages[0]?.messages.find((m) => m.id === threadParentId);
  if (!parent) return null;
  const sender = members.find((m) => m.id === parent.senderId);
  return (
    <div className="border-b border-[var(--hairline)] px-4 py-3">
      <p className="text-xs text-muted-foreground">{sender?.displayName ?? "Someone"}</p>
      {parent.deletedAt ? (
        <p className="text-sm italic text-muted-foreground">This message was deleted</p>
      ) : (
        <div
          className="mt-1 break-words text-sm [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: renderMarkdownToSafeHtml(parent.content) }}
        />
      )}
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        {parent.replyCount} {parent.replyCount === 1 ? "reply" : "replies"}
      </p>
    </div>
  );
}

function PresenceLine({
  conversationId,
  lastSeenAt,
}: {
  conversationId: string;
  /** Set for 1:1 DMs: the other person's persisted heartbeat. */
  lastSeenAt: string | null;
}) {
  const { members } = usePresence(pulseChannel.conv(conversationId), {
    collapseByUserId: true,
  });
  const count = members.length;
  // We are one of the present members, so someone else is here when count > 1.
  const othersHere = count > 1;
  const label = othersHere
    ? count === 2
      ? "Online"
      : `${count} active`
    : lastSeenAt
      ? lastSeenLabel(lastSeenAt)
      : "Offline";
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className="inline-block size-2 rounded-full"
        style={{ background: othersHere ? "#3ddc97" : "#6b6b6b" }}
      />
      {label}
    </p>
  );
}

function appendMessageForKey(data: MessagesInfinite | undefined, message: Message) {
  return appendMessage(data, message);
}

function ComposerWithRealtime({
  conversationId,
  currentUserId,
  displayName,
  realtimeEnabled,
  threadParentId,
  lastOwnMessageId,
  mentionCandidates,
  onSend,
}: {
  conversationId: string;
  currentUserId: string;
  displayName: string;
  realtimeEnabled: boolean;
  threadParentId: string | null;
  lastOwnMessageId: string | null;
  mentionCandidates: User[];
  onSend: (content: string, files: File[]) => Promise<void>;
}) {
  if (!realtimeEnabled) {
    return (
      <MessageComposer
        conversationId={conversationId}
        threadParentId={threadParentId}
        lastOwnMessageId={lastOwnMessageId}
        mentionCandidates={mentionCandidates}
        onSend={onSend}
      />
    );
  }
  return (
    <ComposerTyping
      conversationId={conversationId}
      currentUserId={currentUserId}
      displayName={displayName}
      threadParentId={threadParentId}
      lastOwnMessageId={lastOwnMessageId}
      mentionCandidates={mentionCandidates}
      onSend={onSend}
    />
  );
}

function ComposerTyping({
  conversationId,
  currentUserId,
  displayName,
  threadParentId,
  lastOwnMessageId,
  mentionCandidates,
  onSend,
}: {
  conversationId: string;
  currentUserId: string;
  displayName: string;
  threadParentId: string | null;
  lastOwnMessageId: string | null;
  mentionCandidates: User[];
  onSend: (content: string, files: File[]) => Promise<void>;
}) {
  const client = useRealtimeClient();
  const ty = pulseChannel.typing(conversationId);
  // Typing is best-effort: while offline, publish rejects "not connected".
  return (
    <MessageComposer
      conversationId={conversationId}
      threadParentId={threadParentId}
      lastOwnMessageId={lastOwnMessageId}
      mentionCandidates={mentionCandidates}
      onSend={onSend}
      onTypingStart={() => {
        client
          .publish(
            ty,
            "typing.start",
            { userId: currentUserId, displayName, threadParentId },
            { ephemeral: true },
          )
          .catch(() => undefined);
      }}
      onTypingStop={() => {
        client
          .publish(ty, "typing.stop", { userId: currentUserId, threadParentId }, { ephemeral: true })
          .catch(() => undefined);
      }}
    />
  );
}
