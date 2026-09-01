"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { qk } from "@/src/core/sync/query-keys";
import { api } from "@/src/lib/api-client";

export function NotificationsPanel() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: qk.notifications,
    queryFn: () => api.listNotifications(),
  });
  const items = data?.items ?? [];

  async function markRead(id: string) {
    await api.markNotificationsRead([id]);
    await queryClient.invalidateQueries({ queryKey: qk.notifications });
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
      <h1 className="text-lg font-semibold">Notifications</h1>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--hairline)] border border border-[var(--hairline)] bg-[var(--surface)]">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="capitalize text-foreground">
                  {item.kind === "incoming_call"
                    ? "Incoming call"
                    : item.kind === "missed_call"
                      ? "Missed call"
                      : item.kind.replace("_", " ")}
                </p>
                <Link
                  href={
                    item.workspaceId
                      ? `/w/${item.workspaceId}/channel/${item.conversationId}`
                      : `/dm/${item.conversationId}`
                  }
                  className="text-xs text-foreground underline"
                >
                  Open conversation
                </Link>
              </div>
              {!item.readAt ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => void markRead(item.id)}
                >
                  Mark read
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
