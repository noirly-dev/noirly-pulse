"use client";

import { useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ConversationPeer, Message } from "@/src/core/models/types";
import { patchMessage, tombstoneMessage, type MessagesInfinite } from "@/src/core/sync/message-cache";
import { EmojiPicker } from "@/src/features/chat/EmojiPicker";
import { ImageLightbox } from "@/src/features/chat/ImageLightbox";
import { useUIStore } from "@/src/stores/ui-store";
import { renderMarkdownToSafeHtml } from "@/src/core/markdown/sanitize";
import { cn } from "@/src/lib/cn";
import { CallLogBubble } from "@/src/features/calls/CallLogBubble";
import { api } from "@/src/lib/api-client";
import { Button } from "@noirly-dev/ui";
import { Avatar } from "@/src/components/Avatar";

type Props = {
  message: Message;
  currentUserId: string;
  mine: boolean;
  sender?: ConversationPeer;
  showAvatar: boolean;
  receipt?: "sending" | "failed" | "delivered" | "seen" | null;
  /** Group DMs: members who have read up to this message. */
  seenBy?: number;
  /** Animate arrival only when the list is pinned to the bottom (§8.4). */
  animateIn?: boolean;
  onRetry?: () => void;
  onDiscard?: () => void;
  onOpenThread?: (messageId: string) => void;
  canModerate?: boolean;
};

export function MessageBubble({
  message,
  currentUserId,
  mine,
  sender,
  showAvatar,
  receipt,
  seenBy = 0,
  animateIn = true,
  onRetry,
  onDiscard,
  onOpenThread,
  canModerate = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [picker, setPicker] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const reactButton = useRef<HTMLButtonElement>(null);
  const editRequest = useUIStore((s) => s.editMessageId);

  // "E" in an empty composer asks the latest own message to enter edit mode.
  useEffect(() => {
    if (editRequest && editRequest === message.id) {
      setDraft(message.content);
      setEditing(true);
      useUIStore.getState().setEditMessageId(null);
    }
  }, [editRequest, message.id, message.content]);

  function patchCache(update: (old: MessagesInfinite) => MessagesInfinite) {
    queryClient.setQueriesData<MessagesInfinite>(
      { queryKey: ["messages", message.conversationId] },
      (old) => (old ? update(old) : old),
    );
  }

  async function react(emoji: string) {
    const result = await api.toggleReaction(message.id, emoji).catch(() => null);
    if (!result) return;
    patchCache((old) => {
      const existing = findMessage(old, message.id);
      if (!existing) return old;
      const others = existing.reactions.filter((r) => r.emoji !== emoji);
      const row = existing.reactions.find((r) => r.emoji === emoji);
      const userId = currentUserId;
      const ids = new Set(row?.userIds ?? []);
      if (result.added) ids.add(userId);
      else ids.delete(userId);
      const reactions = ids.size
        ? existing.reactions.map((r) => (r.emoji === emoji ? { ...r, userIds: [...ids] } : r))
        : others;
      if (!row && ids.size) reactions.push({ emoji, userIds: [...ids] });
      return patchMessage(old, message.id, { reactions });
    });
  }

  async function remove() {
    const label = canModerate && !mine ? "Delete this message as admin?" : "Delete this message?";
    if (!confirm(label)) return;
    const result = await api.deleteMessage(message.id).catch(() => null);
    if (result?.message.deletedAt) {
      patchCache((old) => tombstoneMessage(old, message.id, result.message.deletedAt!));
    }
  }

  function onMessageKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || editing || deleted) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if ((event.key === "r" || event.key === "R") && onOpenThread && !message.threadParentId) {
      event.preventDefault();
      onOpenThread(message.id);
    } else if (event.key === "+") {
      event.preventDefault();
      setPicker(true);
    } else if ((event.key === "e" || event.key === "E") && mine) {
      event.preventDefault();
      setDraft(message.content);
      setEditing(true);
    }
  }

  const deleted = Boolean(message.deletedAt);
  const failed = message.localStatus === "failed";
  const sending = message.localStatus === "sending";
  const callLog = message.kind === "call_log";

  if (callLog) {
    return <CallLogBubble content={message.content} callLog={message.callLog} createdAt={message.createdAt} />;
  }

  async function saveEdit() {
    const next = draft.trim();
    if (!next || next === message.content) {
      setEditing(false);
      return;
    }
    const result = await api.editMessage(message.id, next).catch(() => null);
    if (result) {
      patchCache((old) =>
        patchMessage(old, message.id, {
          content: result.message.content,
          editedAt: result.message.editedAt,
        }),
      );
    }
    setEditing(false);
  }

  return (
    <motion.div
      initial={animateIn ? { opacity: 0, y: reduceMotion ? 0 : 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      tabIndex={0}
      aria-label={`${mine ? "You" : (sender?.displayName ?? "Someone")}: ${
        deleted ? "deleted message" : message.content.slice(0, 120)
      }`}
      onKeyDown={onMessageKeyDown}
      className={cn(
        "group flex gap-2 px-4 outline-none focus-visible:bg-[var(--surface-2)]",
        mine ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div className="mt-1 w-7 shrink-0">
        {!mine && showAvatar && sender ? (
          <Avatar name={sender.displayName} src={sender.avatarUrl} size="sm" />
        ) : null}
      </div>
      <div className={cn("max-w-[min(72%,36rem)]", mine ? "items-end" : "items-start")}>
        {!mine && showAvatar && sender ? (
          <p className="mb-1 px-1 text-xs text-muted-foreground">{sender.displayName}</p>
        ) : null}
        <div
          className={cn(
            "border border border-[var(--hairline)] px-3 py-2 text-[15px] leading-6",
            deleted && "bg-transparent italic text-muted-foreground",
            failed && "border border-[var(--hairline)] bg-transparent text-foreground",
            sending && !failed && "bg-ink/55 text-canvas",
            mine && !deleted && !failed && !sending && "bg-[var(--accent-soft)] text-[var(--accent)]",
            !mine && !deleted && "bg-[var(--surface)] text-foreground",
          )}
        >
          {deleted ? (
            "This message was deleted"
          ) : editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                autoFocus
                aria-label="Edit message"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void saveEdit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setEditing(false);
                  }
                }}
                className="w-full rounded-md bg-ink/10 p-2 text-sm text-inherit outline-none"
                rows={3}
              />
              <div className="flex gap-2">
                <Button className="h-7 px-2 text-xs" onClick={() => void saveEdit()}>
                  Save
                </Button>
                <Button
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {message.content ? (
                <div
                  className="break-words [&_a]:underline [&_code]:rounded [&_code]:bg-ink/10 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px]"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdownToSafeHtml(message.content),
                  }}
                />
              ) : null}
              {message.attachments.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((file) =>
                    file.kind === "image" ? (
                      <button
                        key={file.id}
                        type="button"
                        className="block cursor-zoom-in"
                        aria-label={`Open image ${file.filename}`}
                        onClick={() => setLightbox({ src: file.url, alt: file.filename })}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={file.url} alt={file.filename} className="max-h-64 rounded-lg" />
                      </button>
                    ) : (
                      <a
                        key={file.id}
                        href={file.url}
                        className="block text-sm underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {file.filename}
                      </a>
                    ),
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
        {message.reactions.length > 0 ? (
          <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "justify-start")}>
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                onClick={() => void react(reaction.emoji)}
                aria-label={`${reaction.emoji} ${reaction.userIds.length}, toggle reaction`}
                className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs"
              >
                {reaction.emoji} {reaction.userIds.length}
              </button>
            ))}
          </div>
        ) : null}
        <div
          className={cn(
            "mt-1 flex items-center gap-2 text-[11px] text-muted-foreground",
            mine ? "justify-end" : "justify-start",
          )}
        >
          <time className="font-mono">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          {message.editedAt && !deleted ? <span>edited</span> : null}
          {receipt === "sending" ? <span>Sending…</span> : null}
          {receipt === "delivered" ? <span>Delivered</span> : null}
          {receipt === "seen" ? <span>Seen</span> : null}
          {seenBy > 0 ? <span>Seen by {seenBy}</span> : null}
          {failed ? (
            <>
              <button type="button" className="text-foreground" onClick={onRetry}>
                Retry
              </button>
              <button type="button" onClick={onDiscard}>
                Discard
              </button>
            </>
          ) : null}
          {!deleted && !failed && message.localStatus !== "sending" && !message.threadParentId && onOpenThread ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onOpenThread(message.id)}
            >
              {message.replyCount > 0 ? `${message.replyCount} replies` : "Reply in thread"}
            </button>
          ) : null}
        </div>
        {!deleted && !failed && message.localStatus !== "sending" ? (
          <div
            className={cn(
              "relative mt-1 gap-1 group-hover:flex group-focus-within:flex",
              picker ? "flex" : "hidden",
              mine ? "justify-end" : "justify-start",
            )}
          >
            <button
              ref={reactButton}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={picker}
              className="rounded px-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setPicker((v) => !v)}
            >
              React
            </button>
            {mine || canModerate ? (
              <>
                {mine ? (
                  <button
                    type="button"
                    className="rounded px-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setDraft(message.content);
                      setEditing(true);
                    }}
                  >
                    Edit
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded px-1 text-xs text-foreground"
                  onClick={() => void remove()}
                >
                  Delete
                </button>
              </>
            ) : null}
            {picker ? (
              <EmojiPicker
                onPick={(emoji) => {
                  setPicker(false);
                  void react(emoji);
                  reactButton.current?.focus();
                }}
                onClose={() => {
                  setPicker(false);
                  reactButton.current?.focus();
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      {lightbox ? (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      ) : null}
    </motion.div>
  );
}

function findMessage(data: MessagesInfinite, id: string): Message | undefined {
  for (const page of data.pages) {
    const hit = page.messages.find((m) => m.id === id);
    if (hit) return hit;
  }
  return undefined;
}
