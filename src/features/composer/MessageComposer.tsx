"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { User } from "@/src/core/models/types";
import { useComposerStore } from "@/src/stores/ui-store";
import { Button } from "@/src/ui/Button";

type Props = {
  conversationId: string;
  disabled?: boolean;
  mentionCandidates?: User[];
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  onSend: (content: string, files: File[]) => Promise<void>;
};

export function MessageComposer({
  conversationId,
  disabled,
  mentionCandidates = [],
  onTypingStart,
  onTypingStop,
  onSend,
}: Props) {
  const draft = useComposerStore((s) => s.drafts[conversationId] ?? "");
  const setDraft = useComposerStore((s) => s.setDraft);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typing = useRef(false);
  const stopTimer = useRef<number | null>(null);
  const keepAlive = useRef<number | null>(null);

  const mentionOptions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionCandidates
      .filter(
        (user) =>
          user.displayName.toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [mentionCandidates, mentionQuery]);

  function clearTimers() {
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    if (keepAlive.current) window.clearInterval(keepAlive.current);
    stopTimer.current = null;
    keepAlive.current = null;
  }

  function startTyping() {
    if (typing.current) return;
    typing.current = true;
    onTypingStart?.();
    keepAlive.current = window.setInterval(() => onTypingStart?.(), 3000);
  }

  function stopTyping() {
    if (!typing.current) return;
    typing.current = false;
    clearTimers();
    onTypingStop?.();
  }

  function detectMention(value: string) {
    const match = /(?:^|\s)@([\w.-]*)$/.exec(value);
    setMentionQuery(match ? match[1] : null);
  }

  function insertMention(user: User) {
    const token = `[@${user.displayName}](pulse://user/${user.id}) `;
    const next = draft.replace(/(?:^|\s)@[\w.-]*$/, (part) => {
      const prefix = part.startsWith("@") ? "" : part.slice(0, 1);
      return `${prefix}${token}`;
    });
    setDraft(conversationId, next);
    setMentionQuery(null);
  }

  function onChange(value: string) {
    setDraft(conversationId, value);
    detectMention(value);
    if (!value.trim()) {
      stopTyping();
      return;
    }
    startTyping();
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    stopTimer.current = window.setTimeout(() => stopTyping(), 2000);
  }

  async function submit() {
    const content = draft.trim();
    if ((!content && files.length === 0) || sending) return;
    setSending(true);
    try {
      stopTyping();
      setMentionQuery(null);
      await onSend(content, files);
      setDraft(conversationId, "");
      setFiles([]);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && mentionOptions.length === 0) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="relative border-t border-dashed border-hairline bg-canvas p-3">
      {mentionOptions.length > 0 ? (
        <ul className="absolute bottom-full left-3 right-3 mb-1 max-h-40 overflow-y-auto border border-dashed border-hairline bg-surface py-1">
          {mentionOptions.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-ink hover:text-canvas"
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertMention(user);
                }}
              >
                <span>{user.displayName}</span>
                <span className="text-xs text-muted">{user.email}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {files.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-2 text-xs text-muted">
          {files.map((file) => (
            <li key={file.name} className="rounded bg-surface px-2 py-1">
              {file.name}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-end gap-2 border border-dashed border-hairline bg-surface p-2">
        <button
          type="button"
          className="size-9 rounded-lg text-muted hover:bg-ink hover:text-canvas hover:text-ink"
          aria-label="Attach file"
          onClick={() => fileRef.current?.click()}
        >
          +
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            setFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <textarea
          value={draft}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={stopTyping}
          rows={1}
          placeholder="Message"
          aria-label="Message"
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm text-ink outline-none placeholder:text-muted"
        />
        <Button
          className="h-9 px-3"
          disabled={disabled || sending || (!draft.trim() && files.length === 0)}
          onClick={() => void submit()}
        >
          Send
        </Button>
      </div>
      <p className="mt-1 px-1 font-mono text-[10px] text-muted">
        Enter to send · Shift+Enter for a new line · @ to mention
      </p>
    </div>
  );
}
