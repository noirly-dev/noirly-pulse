"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@noirly-dev/ui";
import { qk } from "@/src/core/sync/query-keys";
import { CreateChannelDialog } from "@/src/features/channels/CreateChannelDialog";
import { useCan } from "@/src/features/workspace/WorkspaceRoleContext";
import { api } from "@/src/lib/api-client";

type Props = { workspaceId: string };

/**
 * Browse channels (§7.2 `/w/{id}/channels`). Public channels are open to every
 * workspace member; opening one joins it (the page upserts membership).
 */
export function ChannelDirectory({ workspaceId }: Props) {
  const queryClient = useQueryClient();
  const canCreate = useCan("channel.create");
  const [filter, setFilter] = useState("");
  const params = useSearchParams();
  // `?new=1` comes from the command palette's "Create channel".
  const [createOpen, setCreateOpen] = useState(() => canCreate && params.get("new") === "1");
  const { data, isLoading } = useQuery({
    queryKey: qk.channels(workspaceId),
    queryFn: () => api.listChannels(workspaceId),
  });
  const needle = filter.trim().toLowerCase();
  const channels = (data?.channels ?? []).filter((channel) => {
    if (!needle) return true;
    return [channel.name, channel.slug, channel.topic]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(needle));
  });

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4 p-6" aria-labelledby="channel-directory">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="channel-directory" className="text-lg font-semibold">
            Channels
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Public channels are open to everyone in the workspace. Private channels you
            belong to are listed too.
          </p>
        </div>
        {canCreate ? (
          <Button className="h-9 shrink-0 px-3" onClick={() => setCreateOpen(true)}>
            New channel
          </Button>
        ) : null}
      </div>
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter channels"
        aria-label="Filter channels"
      />
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {!isLoading && channels.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {needle ? "No channels match." : "No channels yet."}
        </p>
      ) : null}
      <ul className="divide-y divide-[var(--hairline)] border border-[var(--hairline)] bg-[var(--surface)]">
        {channels.map((channel) => (
          <li key={channel.id}>
            <Link
              href={`/w/${workspaceId}/channel/${channel.id}`}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[var(--surface-2)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-foreground">
                  #{channel.name ?? channel.slug}
                </span>
                {channel.topic ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {channel.topic}
                  </span>
                ) : null}
              </span>
              {channel.visibility === "private" ? (
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  Private
                </span>
              ) : null}
              {channel.unreadCount > 0 ? (
                <span
                  className="font-mono text-[11px] text-[var(--accent)]"
                  aria-label={`${channel.unreadCount} unread`}
                >
                  {channel.unreadCount > 99 ? "99+" : channel.unreadCount}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      <CreateChannelDialog
        open={createOpen}
        workspaceId={workspaceId}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: qk.channels(workspaceId) });
        }}
      />
    </section>
  );
}
