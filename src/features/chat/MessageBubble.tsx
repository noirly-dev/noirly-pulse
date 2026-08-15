"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { ConversationPeer, Message } from "@/src/core/models/types";
import { renderMarkdownToSafeHtml } from "@/src/core/markdown/sanitize";
import { cn } from "@/src/lib/cn";
import { api } from "@/src/lib/api-client";
import { Avatar } from "@/src/ui/Avatar";
import { Button } from "@/src/ui/Button";

const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "👀", "🔥"];

type Props = {
  message: Message;
  mine: boolean;
  sender?: ConversationPeer;
  showAvatar: boolean;
  receipt?: "sending" | "failed" | "delivered" | "seen" | null;
  onRetry?: () => void;
  onDiscard?: () => void;
  onOpenThread?: (messageId: string) => void;
  canModerate?: boolean;
};

export function MessageBubble({
  message,
  mine,
  sender,
  showAvatar,
  receipt,
  onRetry,
  onDiscard,
  onOpenThread,
  canModerate = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [picker, setPicker] = useState(false);

  const deleted = Boolean(message.deletedAt);
  const failed = message.localStatus === "failed";
  const sending = message.localStatus === "sending";

  async function saveEdit() {
    const next = draft.trim();
    if (!next || next === message.content) {
      setEditing(false);
      return;
    }
    await api.editMessage(message.id, next);
    setEditing(false);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn("group flex gap-2 px-4", mine ? "flex-row-reverse" : "flex-row")}
    >
      <div className="mt-1 w-7 shrink-0">
        {!mine && showAvatar && sender ? (
          <Avatar name={sender.displayName} src={sender.avatarUrl} size="sm" />
        ) : null}
      </div>
      <div className={cn("max-w-[min(72%,36rem)]", mine ? "items-end" : "items-start")}>
        {!mine && showAvatar && sender ? (
          <p className="mb-1 px-1 text-xs text-[#A3A3A3]">{sender.displayName}</p>
        ) : null}
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-[15px] leading-6",
            deleted && "bg-transparent italic text-[#A3A3A3]",
            failed && "border border-np-warning bg-transparent text-[#F5F5F5]",
            sending && !failed && "bg-np-accent/55 text-np-accent-fg",
            mine && !deleted && !failed && !sending && "bg-np-accent text-np-accent-fg",
            !mine && !deleted && "bg-np-surface text-[#F5F5F5]",
          )}
        >
          {deleted ? (
            "This message was deleted"
          ) : editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full rounded-md bg-black/20 p-2 text-sm text-inherit outline-none"
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
                  className="break-words [&_a]:underline [&_code]:rounded [&_code]:bg-black/20 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px]"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdownToSafeHtml(message.content),
                  }}
                />
              ) : null}
              {message.attachments.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((file) =>
                    file.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={file.id}
                        src={file.url}
                        alt={file.filename}
                        className="max-h-64 rounded-lg"
                      />
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
                onClick={() => void api.toggleReaction(message.id, reaction.emoji)}
                className="rounded-full bg-np-surface px-2 py-0.5 text-xs"
              >
                {reaction.emoji} {reaction.userIds.length}
              </button>
            ))}
          </div>
        ) : null}
        <div
          className={cn(
            "mt-1 flex items-center gap-2 text-[11px] text-[#737373]",
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
          {failed ? (
            <>
              <button type="button" className="text-np-warning" onClick={onRetry}>
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
              className="text-[#A3A3A3] hover:text-[#F5F5F5]"
              onClick={() => onOpenThread(message.id)}
            >
              {message.replyCount > 0 ? `${message.replyCount} replies` : "Reply in thread"}
            </button>
          ) : null}
        </div>
        {!deleted && !failed && message.localStatus !== "sending" ? (
          <div
            className={cn(
              "relative mt-1 hidden gap-1 group-hover:flex group-focus-within:flex",
              mine ? "justify-end" : "justify-start",
            )}
          >
            <button
              type="button"
              className="rounded px-1 text-xs text-[#A3A3A3] hover:text-[#F5F5F5]"
              onClick={() => setPicker((v) => !v)}
            >
              React
            </button>
            {mine || canModerate ? (
              <>
                {mine ? (
                  <button
                    type="button"
                    className="rounded px-1 text-xs text-[#A3A3A3] hover:text-[#F5F5F5]"
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
                  className="rounded px-1 text-xs text-np-warning"
                  onClick={() => {
                    const label = canModerate && !mine ? "Delete this message as admin?" : "Delete this message?";
                    if (confirm(label)) void api.deleteMessage(message.id);
                  }}
                >
                  Delete
                </button>
              </>
            ) : null}
            {picker ? (
              <div className="absolute bottom-6 z-10 flex gap-1 rounded-lg border border-np-border bg-np-surface p-1">
                {QUICK_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="size-8 rounded hover:bg-np-surface-hover"
                    onClick={() => {
                      setPicker(false);
                      void api.toggleReaction(message.id, emoji);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
