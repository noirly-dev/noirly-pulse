"use client";

import { usePresence } from "@noirly-dev/realtime-client/react";
import { pulseChannel } from "@/src/core/realtime/channels";
import { Avatar } from "@/src/components/Avatar";

export function PresenceAvatars({ conversationId }: { conversationId: string }) {
  const { members } = usePresence(pulseChannel.conv(conversationId), {
    collapseByUserId: true,
  });
  const visible = members.slice(0, 5);
  if (visible.length === 0) return null;
  return (
    <div className="flex -space-x-2">
      {visible.map((member) => (
        <Avatar
          key={member.userId}
          name={String(member.data?.displayName ?? member.userId)}
          src={(member.data?.avatarUrl as string | null | undefined) ?? null}
          size="sm"
          className="ring-2 ring-canvas"
        />
      ))}
      {members.length > 5 ? (
        <span className="flex size-8 items-center justify-center bg-[var(--surface)] text-[10px] text-muted-foreground ring-2 ring-canvas">
          +{members.length - 5}
        </span>
      ) : null}
    </div>
  );
}
