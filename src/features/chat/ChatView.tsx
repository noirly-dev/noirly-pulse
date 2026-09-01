"use client";

import { useRealtimeClient } from "@noirly-dev/realtime-client/react";
import { usePresence } from "@noirly-dev/realtime-client/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import type { Message, User } from "@/src/core/models/types";
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
}: Props) {
  const searchParams = useSearchParams();
  const highlightMessageId = searchParams.get("msg");
  const queryClient = useQueryClient();
  const realtimeEnabled = Boolean(process.env.NEXT_PUBLIC_REALTIME_WS_URL);
  const { data, isError } = useQuery({
    queryKey: qk.conversation(conversationId),
    queryFn: () => api.getConversation(conversationId),
  });
  const conversation = data?.conversation;
  const title = conversation ? conversationTitle(conversation, currentUserId) : "Conversation";
  const typing = useTypingStore((s) => s.byConv[conversationId] ?? {});
  const typers = Object.values(typing).filter(
    (row) =>
      row.userId !== currentUserId &&
      (row.threadParentId ?? null) === (threadParentId ?? null),
  );
  const readTimer = useRef<number | null>(null);
  const names = typers.map(
    (row) => conversation?.members.find((m) => m.id === row.userId)?.displayName ?? "Someone",
  );

  useEffect(() => {
    useUnreadStore.getState().clear(conversationId);
  }, [conversationId]);

  function markLatestRead(message: Message) {
    if (message.senderId === currentUserId) return;
    if (readTimer.current) window.clearTimeout(readTimer.current);
    readTimer.current = window.setTimeout(() => {
      void api.markRead(conversationId, message.id);
    }, 800);
  }

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
      {realtimeEnabled ? (
        <ConversationRealtime
          conversationId={conversationId}
          currentUserId={currentUserId}
          displayName={displayName}
          avatarUrl={avatarUrl}
        />
      ) : null}
      <header className="flex items-center gap-3 border-b border border-[var(--hairline)] px-4 py-3">
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
            <PresenceLine conversationId={conversationId} />
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
      <div
        className="flex min-h-0 flex-1 flex-col"
        onMouseMove={() => {
          const pages = queryClient.getQueryData<MessagesInfinite>(
            qk.messages(conversationId, "root"),
          );
          const last = pages?.pages[0]?.messages.at(-1);
          if (last) void markLatestRead(last);
        }}
      >
        <MessageList
          conversation={conversation}
          currentUserId={currentUserId}
          threadParentId={threadParentId}
          highlightMessageId={highlightMessageId}
          canModerate={canModerate}
          onOpenThread={onOpenThread}
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
        mentionCandidates={mentionCandidates}
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

function PresenceLine({ conversationId }: { conversationId: string }) {
  const { members } = usePresence(pulseChannel.conv(conversationId), {
    collapseByUserId: true,
  });
  const count = members.length;
  return (
    <p className="text-xs text-muted-foreground">
      {count > 1 ? `${count} active` : count === 1 ? "Active now" : "Offline"}
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
  mentionCandidates,
  onSend,
}: {
  conversationId: string;
  currentUserId: string;
  displayName: string;
  realtimeEnabled: boolean;
  threadParentId: string | null;
  mentionCandidates: User[];
  onSend: (content: string, files: File[]) => Promise<void>;
}) {
  if (!realtimeEnabled) {
    return (
      <MessageComposer
        conversationId={conversationId}
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
  mentionCandidates,
  onSend,
}: {
  conversationId: string;
  currentUserId: string;
  displayName: string;
  threadParentId: string | null;
  mentionCandidates: User[];
  onSend: (content: string, files: File[]) => Promise<void>;
}) {
  const client = useRealtimeClient();
  const ty = pulseChannel.typing(conversationId);
  return (
    <MessageComposer
      conversationId={conversationId}
      mentionCandidates={mentionCandidates}
      onSend={onSend}
      onTypingStart={() => {
        void client.publish(
          ty,
          "typing.start",
          { userId: currentUserId, displayName, threadParentId },
          { ephemeral: true },
        );
      }}
      onTypingStop={() => {
        void client.publish(
          ty,
          "typing.stop",
          { userId: currentUserId, threadParentId },
          { ephemeral: true },
        );
      }}
    />
  );
}
