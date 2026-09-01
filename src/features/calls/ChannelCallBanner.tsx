"use client";

import { useQuery } from "@tanstack/react-query";
import type { ConversationKind } from "@/src/core/models/enums";
import { qk } from "@/src/core/sync/query-keys";
import { api } from "@/src/lib/api-client";
import { Button } from "@noirly-dev/ui";
import { useCallStore } from "@/src/stores/call-store";

export function ChannelCallBanner({
  conversationId,
  currentUserId,
  canModerate,
  conversationKind,
}: {
  conversationId: string;
  currentUserId: string;
  canModerate?: boolean;
  conversationKind?: ConversationKind;
}) {
  const { data } = useQuery({
    queryKey: qk.activeCall(conversationId),
    queryFn: () => api.getActiveCall(conversationId),
  });
  const status = useCallStore((s) => s.status);
  const callId = useCallStore((s) => s.callId);
  const joinCall = useCallStore((s) => s.joinCall);
  const call = data?.call;
  if (!call) return null;
  const live = call.status === "ringing" || call.status === "connecting" || call.status === "active";
  if (!live) return null;
  if (callId === call.id && status !== "idle") return null;
  if (status !== "idle" && callId === call.id) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border border-[var(--hairline)] px-4 py-2 text-sm">
      <p className="text-foreground">Call in progress — Join</p>
      <Button
        variant="ghost"
        className="h-8 px-3 text-xs"
        disabled={status !== "idle"}
        onClick={() =>
          void joinCall({
            callId: call.id,
            currentUserId,
            canModerate,
            conversationKind,
          })
        }
      >
        Join
      </Button>
    </div>
  );
}
