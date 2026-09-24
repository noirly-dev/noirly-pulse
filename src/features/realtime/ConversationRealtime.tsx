"use client";

import {
  usePresence,
  useRealtimeClient,
  useRealtimeEvent,
  useRealtimeStatus,
} from "@noirly-dev/realtime-client/react";
import { useChannel } from "@/src/features/realtime/useChannel";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import type { CallPublic, Message, Reaction, ReadReceipt } from "@/src/core/models/types";
import { pulseChannel } from "@/src/core/realtime/channels";
import {
  appendMessage,
  newestMessageId,
  patchMessage,
  tombstoneMessage,
  type MessagesInfinite,
} from "@/src/core/sync/message-cache";
import { qk } from "@/src/core/sync/query-keys";
import { api } from "@/src/lib/api-client";
import { useTypingStore, useUnreadStore } from "@/src/stores/ui-store";
import { useCallStore } from "@/src/stores/call-store";

type Props = {
  conversationId: string;
  currentUserId: string;
  displayName: string;
  avatarUrl: string | null;
};

function eidKey(channel: string) {
  return `pulse:eid:${channel}`;
}

export function ConversationRealtime({
  conversationId,
  currentUserId,
  displayName,
  avatarUrl,
}: Props) {
  const client = useRealtimeClient();
  const status = useRealtimeStatus();
  const queryClient = useQueryClient();
  const conv = pulseChannel.conv(conversationId);
  const ty = pulseChannel.typing(conversationId);
  // Read once per conversation: a changing lastEventId option would resubscribe.
  const stored = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage.getItem(eidKey(conv));
    } catch {
      return null;
    }
  }, [conv]);

  const { lastEventId, status: convStatus } = useChannel(conv, {
    presence: true,
    lastEventId: stored ?? undefined,
    replayLimit: 100,
  });
  useChannel(ty, { replayLimit: 0 });

  const { join, leave } = usePresence(conv, { collapseByUserId: true });

  // Presence is rebuilt from join snapshots after every (re)subscribe, so join
  // each time the conv channel is subscribed (§5.7). Joining before the
  // subscription is acknowledged is rejected by the server ("not subscribed").
  useEffect(() => {
    if (convStatus !== "subscribed") return;
    let cancelled = false;
    // After a reconnect the client restores subscriptions asynchronously, so a
    // join can briefly race "not subscribed"; retry a few times.
    const attempt = (n: number) => {
      join({ displayName, avatarUrl }).catch(() => {
        if (!cancelled && n < 3) window.setTimeout(() => attempt(n + 1), 400 * (n + 1));
      });
    };
    attempt(0);
    return () => {
      cancelled = true;
      leave().catch(() => undefined);
    };
  }, [convStatus, join, leave, displayName, avatarUrl]);

  useEffect(() => {
    if (!lastEventId) return;
    try {
      window.sessionStorage.setItem(eidKey(conv), lastEventId);
    } catch {
      /* storage unavailable */
    }
  }, [conv, lastEventId]);

  /** Patch every loaded list for this conversation (root + open threads). */
  function patchMessages(updater: (data: MessagesInfinite | undefined) => MessagesInfinite) {
    queryClient.setQueriesData<MessagesInfinite>(
      { queryKey: ["messages", conversationId] },
      (old) => (old ? updater(old) : old),
    );
  }

  useRealtimeEvent<{ message: Message }>(conv, "message.sent", (data) => {
    // Thread replies belong to the thread list only, never the channel root.
    queryClient.setQueryData<MessagesInfinite>(
      qk.messages(conversationId, data.message.threadParentId ?? "root"),
      (old) => appendMessage(old, data.message),
    );
    void queryClient.invalidateQueries({ queryKey: qk.conversations("personal") });
    if (data.message.senderId !== currentUserId) {
      useTypingStore.getState().onStop(conversationId, data.message.senderId, null);
    }
  });

  useRealtimeEvent<{
    messageId: string;
    content: string;
    editedAt: string;
  }>(conv, "message.edited", (data) => {
    patchMessages((old) =>
      patchMessage(old, data.messageId, {
        content: data.content,
        editedAt: data.editedAt,
      }),
    );
  });

  useRealtimeEvent<{ messageId: string; deletedAt: string }>(conv, "message.deleted", (data) => {
    patchMessages((old) => tombstoneMessage(old, data.messageId, data.deletedAt));
  });

  useRealtimeEvent<{ reaction: Reaction }>(conv, "reaction.added", (data) => {
    patchMessages((old) => {
      if (!old) return old as unknown as MessagesInfinite;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          messages: page.messages.map((message) => {
            if (message.id !== data.reaction.messageId) return message;
            const reactions = [...message.reactions];
            const idx = reactions.findIndex((r) => r.emoji === data.reaction.emoji);
            if (idx === -1) {
              reactions.push({ emoji: data.reaction.emoji, userIds: [data.reaction.userId] });
            } else if (!reactions[idx].userIds.includes(data.reaction.userId)) {
              reactions[idx] = {
                ...reactions[idx],
                userIds: [...reactions[idx].userIds, data.reaction.userId],
              };
            }
            return { ...message, reactions };
          }),
        })),
      };
    });
  });

  useRealtimeEvent<{ messageId: string; userId: string; emoji: string }>(
    conv,
    "reaction.removed",
    (data) => {
      patchMessages((old) => {
        if (!old) return old as unknown as MessagesInfinite;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((message) => {
              if (message.id !== data.messageId) return message;
              return {
                ...message,
                reactions: message.reactions
                  .map((r) =>
                    r.emoji === data.emoji
                      ? { ...r, userIds: r.userIds.filter((id) => id !== data.userId) }
                      : r,
                  )
                  .filter((r) => r.userIds.length > 0),
              };
            }),
          })),
        };
      });
    },
  );

  useRealtimeEvent<{ parentId: string; replyCount: number; lastReplyAt: string }>(
    conv,
    "thread.updated",
    (data) => {
      patchMessages((old) => {
        if (!old) return old as unknown as MessagesInfinite;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((message) =>
              message.id === data.parentId
                ? {
                    ...message,
                    replyCount: data.replyCount,
                    lastReplyAt: data.lastReplyAt,
                  }
                : message,
            ),
          })),
        };
      });
    },
  );

  useRealtimeEvent<{ call: CallPublic }>(conv, "call.started", (data) => {
    void queryClient.invalidateQueries({ queryKey: qk.activeCall(conversationId) });
    void queryClient.setQueryData(qk.call(data.call.id), { call: data.call });
  });

  useRealtimeEvent<{ call: CallPublic }>(conv, "call.updated", (data) => {
    void queryClient.setQueryData(qk.call(data.call.id), { call: data.call });
    void queryClient.invalidateQueries({ queryKey: qk.activeCall(conversationId) });
    const store = useCallStore.getState();
    if (store.callId === data.call.id && store.currentUserId) {
      store.hydratePeersFromCall(data.call, store.currentUserId);
    }
  });

  useRealtimeEvent<{ call: CallPublic }>(conv, "call.ended", (data) => {
    void queryClient.invalidateQueries({ queryKey: qk.activeCall(conversationId) });
    useCallStore.getState().applyRemoteEnded(data.call.id);
  });

  useRealtimeEvent<{ receipt: ReadReceipt }>(conv, "read.receipt", (data) => {
    queryClient.setQueryData(qk.conversation(conversationId), (old: unknown) => {
      if (!old || typeof old !== "object") return old;
      const current = old as { conversation: { members: Array<{ id: string }> } };
      return {
        conversation: {
          ...current.conversation,
          members: current.conversation.members.map((member) =>
            member.id === data.receipt.userId
              ? {
                  ...member,
                  lastReadMessageId: data.receipt.lastReadMessageId,
                  lastReadAt: data.receipt.timestamp,
                }
              : member,
          ),
        },
      };
    });
  });

  useRealtimeEvent<{ userId: string; threadParentId: string | null }>(ty, "typing.start", (data) => {
    if (data.userId === currentUserId) return;
    useTypingStore.getState().onStart({
      conversationId,
      userId: data.userId,
      threadParentId: data.threadParentId ?? null,
      startedAt: Date.now(),
    });
  });

  useRealtimeEvent<{ userId: string; threadParentId: string | null }>(ty, "typing.stop", (data) => {
    useTypingStore.getState().onStop(conversationId, data.userId, data.threadParentId ?? null);
  });

  useEffect(() => {
    const id = window.setInterval(() => useTypingStore.getState().pruneExpired(), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return client.on("recovery:gap", () => {
      void catchUp();
    });
  }, [client, conversationId]);

  async function catchUp() {
    const current = queryClient.getQueryData<MessagesInfinite>(
      qk.messages(conversationId, "root"),
    );
    const after = newestMessageId(current);
    if (!after) {
      await queryClient.invalidateQueries({ queryKey: qk.messages(conversationId, "root") });
      return;
    }
    const page = await api.listMessages(conversationId, { after, limit: 100 }).catch(() => null);
    if (!page) return;
    queryClient.setQueryData<MessagesInfinite>(qk.messages(conversationId, "root"), (old) => {
      let next = old;
      for (const message of page.messages) {
        next = appendMessage(next, message);
      }
      return next ?? old;
    });
  }

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void catchUp();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [conversationId]);

  // History is fetched over REST before the subscription is acknowledged; merge
  // anything sent in that window (and after any resubscribe) so it is not lost
  // until the next refresh (§5.7).
  useEffect(() => {
    if (convStatus === "subscribed") void catchUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convStatus, conversationId]);

  // After a dropped connection comes back, merge anything missed (§11.9).
  const prevStatus = useRef(status);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (status !== "ready") return;
    useUnreadStore.getState().clear(conversationId);
    if (was === "reconnecting" || was === "closed") {
      void catchUp();
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
    // Runs on status transitions only; catchUp reads the latest cache itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, conversationId]);

  return null;
}
