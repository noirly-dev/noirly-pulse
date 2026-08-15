"use client";

import { usePresence } from "@noirly-dev/realtime-client/react";
import { pulseChannel } from "@/src/core/realtime/channels";
import { Avatar } from "@/src/ui/Avatar";

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
          className="ring-2 ring-np-bg"
        />
      ))}
      {members.length > 5 ? (
        <span className="flex size-8 items-center justify-center rounded-full bg-np-surface text-[10px] text-[#A3A3A3] ring-2 ring-np-bg">
          +{members.length - 5}
        </span>
      ) : null}
    </div>
  );
}
