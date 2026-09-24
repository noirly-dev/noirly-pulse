"use client";

import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { can } from "@/src/core/permissions/can";
import type { WorkspaceSummary } from "@/src/core/models/types";
import { conversationTitle } from "@/src/core/chat/title";
import { qk } from "@/src/core/sync/query-keys";
import { api } from "@/src/lib/api-client";
import { useUIStore, useWorkspaceStore } from "@/src/stores/ui-store";

const itemClass =
  "flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-foreground data-[selected=true]:bg-ink data-[selected=true]:text-canvas";
const headingClass =
  "mb-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-muted-foreground";

type Props = {
  workspaces: WorkspaceSummary[];
  currentUserId: string;
};

export function CommandPalette({ workspaces, currentUserId }: Props) {
  const router = useRouter();
  const open = useUIStore((state) => state.commandPaletteOpen);
  const setOpen = useUIStore((state) => state.setCommandPaletteOpen);
  const toggle = useUIStore((state) => state.toggleCommandPalette);
  const [search, setSearch] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);

  // Remember what had focus (usually the composer) and restore it on close.
  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      return;
    }
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target?.isConnected) target.focus();
  }, [open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isOpen = useUIStore.getState().commandPaletteOpen;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (isOpen) setSearch("");
        toggle();
        return;
      }
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        setSearch("");
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle, setOpen]);

  function go(href: string) {
    returnFocus.current = null;
    setSearch("");
    setOpen(false);
    router.push(href);
  }

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { data } = useQuery({
    queryKey: qk.conversations("personal"),
    queryFn: () => api.listConversations(),
    enabled: open,
  });
  // Unread first (§11.6), then most recent activity.
  const byUnread = <T extends { unreadCount: number; lastMessageAt: string | null }>(rows: T[]) =>
    [...rows].sort(
      (a, b) =>
        Number(b.unreadCount > 0) - Number(a.unreadCount > 0) ||
        (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""),
    );
  const conversations = byUnread(data?.conversations ?? []);
  const { data: channelData } = useQuery({
    queryKey: qk.channels(activeWorkspaceId),
    queryFn: () => api.listChannels(activeWorkspaceId),
    enabled: open && activeWorkspaceId !== "personal",
  });
  const channels = byUnread(channelData?.channels ?? []);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const inTeam = activeWorkspace?.kind === "team";
  const canCreateChannel = inTeam && can(activeWorkspace.role, "channel.create");
  const canInvite = inTeam && can(activeWorkspace.role, "members.manage");
  const searchBase = inTeam ? `/w/${activeWorkspaceId}/search` : "/search";

  if (!open) return null;

  const teams = workspaces.filter((w) => w.kind === "team");

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Command palette">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-ink/50"
        onClick={() => {
          setSearch("");
          setOpen(false);
        }}
      />
      <div className="relative mx-auto mt-[12vh] w-full max-w-lg px-4">
        <Command
          className="overflow-hidden border border border-[var(--hairline)] bg-[var(--surface)]"
          loop
        >
          <Command.Input
            autoFocus
            value={search}
            onValueChange={setSearch}
            placeholder="Jump to a workspace or conversation"
            className="h-12 w-full border-b border border-[var(--hairline)] bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches.
            </Command.Empty>
            <Command.Group heading="Actions" className={headingClass}>
              <Command.Item
                className={itemClass}
                value={`search messages ${search}`}
                onSelect={() =>
                  go(search.trim() ? `${searchBase}?q=${encodeURIComponent(search.trim())}` : searchBase)
                }
              >
                {search.trim() ? `Search messages for “${search.trim()}”` : "Search messages"}
              </Command.Item>
              <Command.Item className={itemClass} onSelect={() => go("/inbox")}>
                Inbox
              </Command.Item>
              {canCreateChannel ? (
                <Command.Item
                  className={itemClass}
                  onSelect={() => go(`/w/${activeWorkspaceId}/channels?new=1`)}
                >
                  Create channel
                </Command.Item>
              ) : null}
              {canInvite ? (
                <Command.Item
                  className={itemClass}
                  onSelect={() => go(`/w/${activeWorkspaceId}/members`)}
                >
                  Invite people
                </Command.Item>
              ) : null}
              <Command.Item className={itemClass} onSelect={() => go("/settings")}>
                Settings
              </Command.Item>
            </Command.Group>
            {channels.length > 0 ? (
              <Command.Group heading="Channels" className={headingClass}>
                {channels.map((channel) => (
                  <Command.Item
                    key={channel.id}
                    className={itemClass}
                    onSelect={() => go(`/w/${activeWorkspaceId}/channel/${channel.id}`)}
                  >
                    <span>#{channel.name ?? channel.slug}</span>
                    {channel.unreadCount > 0 ? (
                      <span className="font-mono text-[10px]">{channel.unreadCount} unread</span>
                    ) : null}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            {conversations.length > 0 ? (
              <Command.Group heading="Direct messages" className={headingClass}>
                {conversations.map((conversation) => (
                  <Command.Item
                    key={conversation.id}
                    className={itemClass}
                    onSelect={() => go(`/dm/${conversation.id}`)}
                  >
                    <span>{conversationTitle(conversation, currentUserId)}</span>
                    {conversation.unreadCount > 0 ? (
                      <span className="font-mono text-[10px]">{conversation.unreadCount} unread</span>
                    ) : null}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            {teams.length > 0 ? (
              <Command.Group heading="Workspaces" className={headingClass}>
                {teams.map((workspace) => (
                  <Command.Item
                    key={workspace.id}
                    className={itemClass}
                    onSelect={() => go(`/w/${workspace.id}`)}
                  >
                    {workspace.name}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
