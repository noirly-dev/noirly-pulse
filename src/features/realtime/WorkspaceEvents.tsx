"use client";

import { useRealtimeEvent } from "@noirly-dev/realtime-client/react";
import { useQueryClient } from "@tanstack/react-query";
import type { Channel } from "@/src/core/models/types";
import { pulseChannel } from "@/src/core/realtime/channels";
import { qk } from "@/src/core/sync/query-keys";
import { useChannel } from "@/src/features/realtime/useChannel";

export function WorkspaceEvents({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const ws = pulseChannel.workspace(workspaceId);
  // The shell must hold ws:{activeWorkspaceId} (§5.5); without a subscription
  // none of the handlers below ever fire.
  useChannel(ws, { presence: true, replayLimit: 20 });

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
