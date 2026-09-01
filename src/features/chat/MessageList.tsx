"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ConversationPeer, ConversationSummary, Message } from "@/src/core/models/types";
import {
  appendMessage,
  markFailed,
  removeByNonce,
  replaceNonce,
  type MessagesInfinite,
} from "@/src/core/sync/message-cache";
import { qk } from "@/src/core/sync/query-keys";
import { MessageBubble } from "@/src/features/chat/MessageBubble";
import { api } from "@/src/lib/api-client";
import { LiveRegion } from "@/src/components/LiveRegion";

type Props = {
  conversation: ConversationSummary;
  currentUserId: string;
  threadParentId?: string | null;
  highlightMessageId?: string | null;
  canModerate?: boolean;
  onOpenThread?: (messageId: string) => void;
};

function receiptFor(
  message: Message,
  conversation: ConversationSummary,
  currentUserId: string,
  isLastOwn: boolean,
): "sending" | "failed" | "delivered" | "seen" | null {
  if (message.senderId !== currentUserId) return null;
  if (message.localStatus === "sending") return "sending";
  if (message.localStatus === "failed") return "failed";
  if (conversation.kind !== "dm" || !isLastOwn) return null;
  const other = conversation.members.find((m) => m.id !== currentUserId);
  if (!other?.lastReadMessageId) return "delivered";
  return other.lastReadMessageId >= message.id ? "seen" : "delivered";
}

export function MessageList({
  conversation,
  currentUserId,
  threadParentId = null,
  highlightMessageId = null,
  canModerate = false,
  onOpenThread,
}: Props) {
  const queryClient = useQueryClient();
  const scroller = useRef<HTMLDivElement>(null);
  const pin = useRef(true);
  const [pendingNew, setPendingNew] = useState(0);
  const threadKey = threadParentId ?? "root";
  const key = qk.messages(conversation.id, threadKey);
  const prevLength = useRef(0);

  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) =>
      api.listMessages(conversation.id, {
        before: pageParam,
        limit: 50,
        threadParentId,
        ...(highlightMessageId && !pageParam
          ? { anchorMessageId: highlightMessageId }
          : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const messages = useMemo(() => {
    const pages = query.data?.pages ?? [];
    return [...pages].reverse().flatMap((page) => page.messages);
  }, [query.data]);

  const membersById = useMemo(() => {
    const map = new Map<string, ConversationPeer>();
    for (const member of conversation.members) map.set(member.id, member);
    return map;
  }, [conversation.members]);

  const lastOwnId = [...messages].reverse().find((m) => m.senderId === currentUserId)?.id;

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => 88,
    overscan: 8,
  });

  useEffect(() => {
    if (messages.length > prevLength.current && !pin.current) {
      setPendingNew((count) => count + (messages.length - prevLength.current));
    }
    prevLength.current = messages.length;
    const el = scroller.current;
    if (el && pin.current) {
      el.scrollTop = el.scrollHeight;
      setPendingNew(0);
    }
  }, [messages.length, conversation.id]);

  useEffect(() => {
    if (!highlightMessageId) return;
    const index = messages.findIndex((message) => message.id === highlightMessageId);
    if (index >= 0) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(index, { align: "center" });
      });
    }
  }, [highlightMessageId, messages, virtualizer]);

  async function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    pin.current = nearBottom;
    if (nearBottom) setPendingNew(0);
    if (el.scrollTop < 80 && query.hasNextPage && !query.isFetchingNextPage) {
      const previous = el.scrollHeight;
      await query.fetchNextPage();
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - previous;
      });
    }
  }

  function jumpToBottom() {
    pin.current = true;
    setPendingNew(0);
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  function retry(message: Message) {
    queryClient.setQueryData<MessagesInfinite>(key, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((row) =>
                row.clientNonce === message.clientNonce
                  ? { ...row, localStatus: "sending" }
                  : row,
              ),
            })),
          }
        : old,
    );
    void api
      .sendMessage(conversation.id, {
        content: message.content,
        clientNonce: message.clientNonce,
        attachmentIds: message.attachments.map((a) => a.id),
        threadParentId,
      })
      .then(({ message: saved }) => {
        queryClient.setQueryData<MessagesInfinite>(key, (old) =>
          replaceNonce(old, message.clientNonce, saved),
        );
      })
      .catch(() => {
        queryClient.setQueryData<MessagesInfinite>(key, (old) =>
          markFailed(old, message.clientNonce),
        );
      });
  }

  const inbound = messages.filter((m) => m.senderId !== currentUserId).at(-1);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {pendingNew > 0 ? (
        <button
          type="button"
          onClick={jumpToBottom}
          className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1 text-xs text-foreground shadow"
        >
          {pendingNew} new message{pendingNew === 1 ? "" : "s"}
        </button>
      ) : null}
      <div
        ref={scroller}
        onScroll={() => void onScroll()}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto py-4"
      >
        {query.hasNextPage ? (
          <button
            type="button"
            className="mb-3 self-center text-xs text-muted-foreground"
            onClick={() => void query.fetchNextPage()}
          >
            Load older messages
          </button>
        ) : null}
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const message = messages[item.index];
            const previous = messages[item.index - 1];
            const showAvatar =
              !previous ||
              previous.senderId !== message.senderId ||
              new Date(message.createdAt).getTime() -
                new Date(previous.createdAt).getTime() >
                5 * 60 * 1000;
            const highlighted = message.id === highlightMessageId;
            return (
              <div
                key={message.clientNonce || message.id}
                data-index={item.index}
                ref={virtualizer.measureElement}
                data-message-id={message.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${item.start}px)`,
                }}
                className={highlighted ? "ring-1 ring-ink/60" : undefined}
              >
                <MessageBubble
                  message={message}
                  mine={message.senderId === currentUserId}
                  sender={membersById.get(message.senderId)}
                  showAvatar={showAvatar}
                  receipt={receiptFor(
                    message,
                    conversation,
                    currentUserId,
                    message.id === lastOwnId,
                  )}
                  canModerate={canModerate}
                  onRetry={() => retry(message)}
                  onDiscard={() =>
                    queryClient.setQueryData<MessagesInfinite>(key, (old) =>
                      removeByNonce(old, message.clientNonce),
                    )
                  }
                  onOpenThread={onOpenThread}
                />
              </div>
            );
          })}
        </div>
        <LiveRegion
          message={
            inbound && !pin.current
              ? `New message from ${membersById.get(inbound.senderId)?.displayName ?? "someone"}`
              : ""
          }
        />
      </div>
    </div>
  );
}

export function insertOptimistic(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  message: Message,
) {
  queryClient.setQueryData<MessagesInfinite>(qk.messages(conversationId, "root"), (old) =>
    appendMessage(old, message),
  );
}
