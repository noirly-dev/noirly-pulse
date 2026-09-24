"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import type { ConversationSummary, Notification } from "@/src/core/models/types";
import { conversationTitle } from "@/src/core/chat/title";
import { qk } from "@/src/core/sync/query-keys";
import { api } from "@/src/lib/api-client";
import { useUnreadStore } from "@/src/stores/ui-store";

type Props = {
  currentUserId: string;
  /** Omit for the cross-scope inbox; set to scope to one team workspace. */
  workspaceId?: string;
};

type Row = {
  conversation: ConversationSummary;
  href: string;
  where: string;
  unread: number;
};

const NOTIFICATION_LABEL: Partial<Record<Notification["kind"], string>> = {
  mention: "Mentioned you",
  thread_reply: "Replied in a thread",
  dm: "New direct message",
  missed_call: "Missed call",
  incoming_call: "Incoming call",
};

/** Unread conversations first, then unread mentions / replies (§7.2 inbox). */
export function InboxList({ currentUserId, workspaceId }: Props) {
  const queryClient = useQueryClient();
  const live = useUnreadStore((s) => s.byConversationId);

  const workspaces = useQuery({
    queryKey: qk.workspaces,
    queryFn: () => api.listWorkspaces(),
    enabled: !workspaceId,
  });
  const teamIds = workspaceId
    ? [workspaceId]
    : (workspaces.data?.workspaces ?? []).filter((w) => w.kind === "team").map((w) => w.id);
  const workspaceName = new Map(
    (workspaces.data?.workspaces ?? []).map((w) => [w.id, w.name] as const),
  );

  const dms = useQuery({
    queryKey: qk.conversations("personal"),
    queryFn: () => api.listConversations(),
    enabled: !workspaceId,
  });
  const channelQueries = useQueries({
    queries: teamIds.map((id) => ({
      queryKey: qk.channels(id),
      queryFn: () => api.listChannels(id),
    })),
  });
  const notifications = useQuery({
    queryKey: qk.notifications,
    queryFn: () => api.listNotifications(),
  });

  const unreadOf = (c: ConversationSummary) => live[c.id] ?? c.unreadCount;
  const rows: Row[] = [];
  for (const conversation of dms.data?.conversations ?? []) {
    rows.push({
      conversation,
      href: `/dm/${conversation.id}`,
      where: "Direct message",
      unread: unreadOf(conversation),
    });
  }
  channelQueries.forEach((result, index) => {
    const id = teamIds[index];
    for (const conversation of result.data?.channels ?? []) {
      rows.push({
        conversation,
        href: `/w/${id}/channel/${conversation.id}`,
        where: workspaceId ? "Channel" : (workspaceName.get(id) ?? "Workspace"),
        unread: unreadOf(conversation),
      });
    }
  });
  const unreadRows = rows
    .filter((row) => row.unread > 0)
    .sort((a, b) =>
      (b.conversation.lastMessageAt ?? "").localeCompare(a.conversation.lastMessageAt ?? ""),
    );
  const byConversation = new Map(rows.map((row) => [row.conversation.id, row] as const));

  // New-DM notifications are already represented by the unread DM row above.
  const pings = (notifications.data?.items ?? []).filter(
    (item) =>
      !item.readAt &&
      item.kind !== "dm" &&
      (!workspaceId || item.workspaceId === workspaceId),
  );

  async function markPingsRead(ids: string[]) {
    if (ids.length === 0) return;
    await api.markNotificationsRead(ids);
    await queryClient.invalidateQueries({ queryKey: qk.notifications });
  }

  const loading =
    notifications.isLoading || dms.isLoading || channelQueries.some((q) => q.isLoading);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-lg font-semibold">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {workspaceId
            ? "Unread channels and mentions in this workspace."
            : "Everything unread across your DMs and workspaces."}
        </p>
      </div>

      <section aria-labelledby="inbox-unread" className="space-y-2">
        <h2
          id="inbox-unread"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          Unread conversations
        </h2>
        {!loading && unreadRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">You are all caught up.</p>
        ) : null}
        <ul className="divide-y divide-[var(--hairline)] border border-[var(--hairline)] bg-[var(--surface)] empty:hidden">
          {unreadRows.map((row) => (
            <li key={row.conversation.id}>
              <Link
                href={row.href}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[var(--surface-2)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-foreground">
                    {row.conversation.kind === "channel"
                      ? `#${row.conversation.name ?? row.conversation.slug}`
                      : conversationTitle(row.conversation, currentUserId)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.where}
                    {row.conversation.lastMessagePreview
                      ? ` · ${row.conversation.lastMessagePreview}`
                      : ""}
                  </span>
                </span>
                <span
                  className="font-mono text-[11px] text-[var(--accent)]"
                  aria-label={`${row.unread} unread`}
                >
                  {row.unread > 99 ? "99+" : row.unread}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="inbox-pings" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2
            id="inbox-pings"
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
          >
            Mentions and replies
          </h2>
          {pings.length > 0 ? (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => void markPingsRead(pings.map((p) => p.id))}
            >
              Mark all read
            </button>
          ) : null}
        </div>
        {!loading && pings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No new mentions.</p>
        ) : null}
        <ul className="divide-y divide-[var(--hairline)] border border-[var(--hairline)] bg-[var(--surface)] empty:hidden">
          {pings.map((item) => {
            const row = byConversation.get(item.conversationId);
            const base = item.workspaceId
              ? `/w/${item.workspaceId}/channel/${item.conversationId}`
              : `/dm/${item.conversationId}`;
            const href = item.messageId ? `${base}?msg=${item.messageId}` : base;
            const actor = row?.conversation.members.find((m) => m.id === item.actorId);
            return (
              <li key={item.id}>
                <Link
                  href={href}
                  onClick={() => void markPingsRead([item.id])}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[var(--surface-2)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground">
                      {actor ? `${actor.displayName} · ` : ""}
                      {NOTIFICATION_LABEL[item.kind] ?? item.kind}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row
                        ? row.conversation.kind === "channel"
                          ? `#${row.conversation.name ?? row.conversation.slug}`
                          : conversationTitle(row.conversation, currentUserId)
                        : "Conversation"}
                    </span>
                  </span>
                  <time
                    dateTime={item.createdAt}
                    className="font-mono text-[11px] text-muted-foreground"
                  >
                    {new Date(item.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
