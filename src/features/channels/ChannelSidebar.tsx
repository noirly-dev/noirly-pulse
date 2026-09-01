"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { qk } from "@/src/core/sync/query-keys";
import { CreateChannelDialog } from "@/src/features/channels/CreateChannelDialog";
import { useCan } from "@/src/features/workspace/WorkspaceRoleContext";
import { api } from "@/src/lib/api-client";
import { cn } from "@/src/lib/cn";
import { useUnreadStore } from "@/src/stores/ui-store";
import { Badge } from "@noirly-dev/ui";

type Props = {
  workspaceId: string;
  onNavigate?: () => void;
};

function itemClass(active: boolean) {
  return cn(
    "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm",
    active
      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
      : "text-muted-foreground hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
  );
}

export function ChannelSidebar({ workspaceId, onNavigate }: Props) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = useCan("channel.create");
  const unread = useUnreadStore((s) => s.byConversationId);
  const { data } = useQuery({
    queryKey: qk.channels(workspaceId),
    queryFn: () => api.listChannels(workspaceId),
  });
  const channels = data?.channels ?? [];

  return (
    <aside className="flex w-[260px] shrink-0 flex-col bg-background">
      <div className="border-b border border-[var(--hairline)] px-4 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Channels
        </p>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-2 w-full px-3 py-2 text-left text-sm text-foreground hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            New channel
          </button>
        ) : null}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-1 py-3">
        <Link
          href={`/w/${workspaceId}`}
          onClick={onNavigate}
          className={itemClass(pathname === `/w/${workspaceId}`)}
        >
          Home
        </Link>
        <Link
          href={`/w/${workspaceId}/members`}
          onClick={onNavigate}
          className={itemClass(pathname.includes("/members"))}
        >
          Members
        </Link>
        <Link
          href={`/w/${workspaceId}/search`}
          onClick={onNavigate}
          className={itemClass(pathname.includes("/search"))}
        >
          Search
        </Link>
        <div className="my-2 h-px border-t border border-[var(--hairline)]" />
        {channels.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No channels yet. Create one to start chatting with your team.
          </p>
        ) : (
          channels.map((channel) => {
            const href = `/w/${workspaceId}/channel/${channel.id}`;
            const active = pathname.startsWith(href);
            const count = unread[channel.id] ?? channel.unreadCount;
            const label = channel.name ?? channel.slug ?? "channel";
            return (
              <Link
                key={channel.id}
                href={href}
                onClick={onNavigate}
                className={itemClass(active)}
              >
                <span className="font-mono text-[10px] uppercase tracking-wide opacity-60">
                  #
                </span>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {channel.visibility === "private" ? (
                  <span className="font-mono text-[10px] uppercase tracking-wide opacity-60">
                    Private
                  </span>
                ) : null}
                {count > 0 ? <Badge>{count > 99 ? "99+" : count}</Badge> : null}
              </Link>
            );
          })
        )}
      </nav>
      <CreateChannelDialog
        open={createOpen}
        workspaceId={workspaceId}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: qk.channels(workspaceId) });
        }}
      />
    </aside>
  );
}
