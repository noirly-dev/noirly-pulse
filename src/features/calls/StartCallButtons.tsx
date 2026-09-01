"use client";

import type { ConversationKind } from "@/src/core/models/enums";
import { IconButton } from "@/src/components/IconButton";
import { useCallStore } from "@/src/stores/call-store";

export function StartCallButtons({
  conversationId,
  peerName,
  peerUserId,
  peerAvatarUrl,
  currentUserId,
  conversationKind,
  canModerate,
  workspaceId,
}: {
  conversationId: string;
  peerName: string;
  peerUserId?: string | null;
  peerAvatarUrl?: string | null;
  currentUserId: string;
  conversationKind?: ConversationKind;
  canModerate?: boolean;
  workspaceId?: string | null;
}) {
  const status = useCallStore((s) => s.status);
  const error = useCallStore((s) => s.error);
  const startCall = useCallStore((s) => s.startCall);
  const busy = status !== "idle";

  return (
    <div className="flex items-center gap-1">
      <IconButton
        label="Start voice call"
        disabled={busy}
        onClick={() =>
          void startCall({
            conversationId,
            type: "audio",
            peerName,
            peerUserId,
            peerAvatarUrl,
            currentUserId,
            conversationKind,
            canModerate,
            workspaceId,
          })
        }
      >
        <PhoneIcon />
      </IconButton>
      <IconButton
        label="Start video call"
        disabled={busy}
        onClick={() =>
          void startCall({
            conversationId,
            type: "video",
            peerName,
            peerUserId,
            peerAvatarUrl,
            currentUserId,
            conversationKind,
            canModerate,
            workspaceId,
          })
        }
      >
        <VideoIcon />
      </IconButton>
      {error ? <span className="sr-only">{error}</span> : null}
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6.5 3.5h3L11 7.5l-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3c0 1-1 2-2.2 2C9.5 19.5 4.5 14.5 4.5 5.7c0-1.2 1-2.2 2-2.2Z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="6.5" width="12" height="11" rx="1.5" />
      <path d="M15.5 10.5 20.5 8v8l-5-2.5" />
    </svg>
  );
}
