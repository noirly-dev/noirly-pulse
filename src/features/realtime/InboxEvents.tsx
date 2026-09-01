"use client";

import { useRealtimeEvent } from "@noirly-dev/realtime-client/react";
import { useQueryClient } from "@tanstack/react-query";
import { pulseChannel } from "@/src/core/realtime/channels";
import { qk } from "@/src/core/sync/query-keys";
import { useUnreadStore } from "@/src/stores/ui-store";
import { useCallStore } from "@/src/stores/call-store";
import type { InboxCallInviteData, InboxCallLifecycleData } from "@/src/core/calls/protocol";

export function InboxEvents({ userId, activeConversationId }: { userId: string; activeConversationId: string | null }) {
  const queryClient = useQueryClient();
  const inbox = pulseChannel.inbox(userId);

  useRealtimeEvent<{ conversationId: string; workspaceId?: string | null }>(
    inbox,
    "inbox.message",
    (data) => {
      void queryClient.invalidateQueries({ queryKey: qk.conversations("personal") });
      void queryClient.invalidateQueries({ queryKey: qk.workspaces });
      if (data.workspaceId) {
        void queryClient.invalidateQueries({ queryKey: qk.channels(data.workspaceId) });
      }
      if (data.conversationId !== activeConversationId) {
        useUnreadStore.getState().bump(data.conversationId);
      }
    },
  );

  useRealtimeEvent<{ conversationId: string }>(inbox, "inbox.mention", (data) => {
    void queryClient.invalidateQueries({ queryKey: qk.notifications });
    if (data.conversationId !== activeConversationId) {
      useUnreadStore.getState().bump(data.conversationId);
    }
  });

  useRealtimeEvent<{ conversationId: string }>(inbox, "inbox.thread_reply", (data) => {
    void queryClient.invalidateQueries({ queryKey: qk.notifications });
    if (data.conversationId !== activeConversationId) {
      useUnreadStore.getState().bump(data.conversationId);
    }
  });

  useRealtimeEvent(inbox, "inbox.dm.created", () => {
    void queryClient.invalidateQueries({ queryKey: qk.conversations("personal") });
  });

  useRealtimeEvent<InboxCallInviteData>(inbox, "inbox.call.invite", (data) => {
    void queryClient.invalidateQueries({ queryKey: qk.notifications });
    void queryClient.invalidateQueries({ queryKey: qk.activeCall(data.conversationId) });
    useCallStore.getState().receiveInvite(data);
  });

  useRealtimeEvent<InboxCallLifecycleData>(inbox, "inbox.call.cancelled", (data) => {
    void queryClient.invalidateQueries({ queryKey: qk.notifications });
    useCallStore.getState().applyRemoteEnded(data.callId);
  });

  useRealtimeEvent<InboxCallLifecycleData>(inbox, "inbox.call.missed", (data) => {
    void queryClient.invalidateQueries({ queryKey: qk.notifications });
    void queryClient.invalidateQueries({ queryKey: qk.messages(data.conversationId, "root") });
    useCallStore.getState().applyRemoteEnded(data.callId);
  });

  useRealtimeEvent<InboxCallLifecycleData>(inbox, "inbox.call.accepted", (data) => {
    useCallStore.getState().applyRemoteAccepted(data.callId);
  });

  useRealtimeEvent<InboxCallLifecycleData>(inbox, "inbox.call.ended", (data) => {
    void queryClient.invalidateQueries({ queryKey: qk.messages(data.conversationId, "root") });
    useCallStore.getState().applyRemoteEnded(data.callId);
  });

  return null;
}
