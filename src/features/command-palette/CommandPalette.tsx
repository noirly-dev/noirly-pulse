"use client";

import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { WorkspaceSummary } from "@/src/core/models/types";
import { conversationTitle } from "@/src/core/chat/title";
import { qk } from "@/src/core/sync/query-keys";
import { api } from "@/src/lib/api-client";
import { useUIStore, useWorkspaceStore } from "@/src/stores/ui-store";

const itemClass =
  "flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-ink data-[selected=true]:bg-ink data-[selected=true]:text-canvas";
const headingClass =
  "mb-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-muted";

type Props = {
  workspaces: WorkspaceSummary[];
  currentUserId: string;
};

export function CommandPalette({ workspaces, currentUserId }: Props) {
  const router = useRouter();
  const open = useUIStore((state) => state.commandPaletteOpen);
  const setOpen = useUIStore((state) => state.setCommandPaletteOpen);
  const toggle = useUIStore((state) => state.toggleCommandPalette);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
        return;
      }
      if (event.key === "Escape" && useUIStore.getState().commandPaletteOpen) {
        event.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle, setOpen]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { data } = useQuery({
    queryKey: qk.conversations("personal"),
    queryFn: () => api.listConversations(),
    enabled: open,
  });
  const conversations = data?.conversations ?? [];
  const { data: channelData } = useQuery({
    queryKey: qk.channels(activeWorkspaceId),
    queryFn: () => api.listChannels(activeWorkspaceId),
    enabled: open && activeWorkspaceId !== "personal",
  });
  const channels = channelData?.channels ?? [];

  if (!open) return null;

  const teams = workspaces.filter((w) => w.kind === "team");

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-ink/50"
        onClick={() => setOpen(false)}
      />
      <div className="relative mx-auto mt-[12vh] w-full max-w-lg px-4">
        <Command
          className="overflow-hidden border border-dashed border-hairline bg-surface"
          loop
        >
          <Command.Input
            autoFocus
            placeholder="Jump to a workspace or conversation"
            className="h-12 w-full border-b border-dashed border-hairline bg-transparent px-4 text-sm text-ink outline-none placeholder:text-muted"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
              No matches.
            </Command.Empty>
            <Command.Group heading="Navigate" className={headingClass}>
              <Command.Item className={itemClass} onSelect={() => go("/inbox")}>
                Inbox
              </Command.Item>
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
                    #{channel.name ?? channel.slug}
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
                    {conversationTitle(conversation, currentUserId)}
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
