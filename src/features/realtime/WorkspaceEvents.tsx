"use client";

import { useRealtimeEvent } from "@noirly-dev/realtime-client/react";
import { useQueryClient } from "@tanstack/react-query";
import { pulseChannel } from "@/src/core/realtime/channels";
import { qk } from "@/src/core/sync/query-keys";

export function WorkspaceEvents({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const ws = pulseChannel.workspace(workspaceId);

  useRealtimeEvent(ws, "channel.created", () => {
    void queryClient.invalidateQueries({ queryKey: qk.channels(workspaceId) });
  });

  useRealtimeEvent(ws, "channel.updated", () => {
    void queryClient.invalidateQueries({ queryKey: qk.channels(workspaceId) });
  });

  useRealtimeEvent(ws, "channel.archived", () => {
    void queryClient.invalidateQueries({ queryKey: qk.channels(workspaceId) });
  });

  useRealtimeEvent(ws, "member.joined", () => {
    void queryClient.invalidateQueries({ queryKey: qk.members(workspaceId) });
  });

  useRealtimeEvent(ws, "member.left", () => {
    void queryClient.invalidateQueries({ queryKey: qk.members(workspaceId) });
  });

  return null;
}
