"use client";

import { useRealtimeEvent } from "@noirly-dev/realtime-client/react";
import { useQueryClient } from "@tanstack/react-query";
import type { Channel } from "@/src/core/models/types";
import { pulseChannel } from "@/src/core/realtime/channels";
import { qk } from "@/src/core/sync/query-keys";

export function WorkspaceEvents({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const ws = pulseChannel.workspace(workspaceId);

  useRealtimeEvent(ws, "channel.created", () => {
    void queryClient.invalidateQueries({ queryKey: qk.channels(workspaceId) });
  });

  useRealtimeEvent<{ channel: Channel }>(ws, "channel.updated", (data) => {
    void queryClient.invalidateQueries({ queryKey: qk.channels(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: qk.conversation(data.channel.id) });
  });

  useRealtimeEvent<{ channelId: string }>(ws, "channel.archived", (data) => {
    void queryClient.invalidateQueries({ queryKey: qk.channels(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: qk.conversation(data.channelId) });
  });

  useRealtimeEvent(ws, "member.joined", () => {
    void queryClient.invalidateQueries({ queryKey: qk.members(workspaceId) });
  });

  // `conversationId` is set when someone left/was removed from a private channel.
  useRealtimeEvent<{ userId: string; conversationId?: string }>(ws, "member.left", (data) => {
    if (data.conversationId) {
      void queryClient.invalidateQueries({ queryKey: qk.channels(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: qk.conversation(data.conversationId) });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: qk.members(workspaceId) });
  });

  return null;
}
