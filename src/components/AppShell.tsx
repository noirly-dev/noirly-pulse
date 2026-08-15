"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { WorkspaceSummary } from "@/src/core/models/types";
import { SignOutButton } from "@/src/features/auth/SignOutButton";
import { CommandPalette } from "@/src/features/command-palette/CommandPalette";
import { InboxEvents } from "@/src/features/realtime/InboxEvents";
import { InboxRealtime } from "@/src/features/realtime/InboxRealtime";
import { WorkspaceEvents } from "@/src/features/realtime/WorkspaceEvents";
import { setRealtimeScope } from "@/src/features/realtime/PulseRealtimeProvider";
import { ConversationSidebar } from "@/src/features/shell/ConversationSidebar";
import { WorkspaceRail } from "@/src/features/shell/WorkspaceRail";
import { api } from "@/src/lib/api-client";
import { useUIStore, useWorkspaceStore } from "@/src/stores/ui-store";
import { Avatar } from "@/src/ui/Avatar";

export type ShellUser = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
};

type Props = {
  user: ShellUser;
  workspaces: WorkspaceSummary[];
  children: ReactNode;
};

export function AppShell({ user, workspaces, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId);

  const workspaceMatch = pathname.startsWith("/w/") ? pathname.split("/")[2] : null;
  const dmMatch = pathname.startsWith("/dm/") ? pathname.split("/")[2] ?? null : null;
  const channelMatch =
    workspaceMatch && pathname.includes("/channel/")
      ? pathname.split("/channel/")[1]?.split("/")[0] ?? null
      : null;
  const conversationId = dmMatch ?? channelMatch;
  const activeId: "personal" | string = workspaceMatch ?? "personal";
  const mode = workspaceMatch ? "workspace" : "personal";
  const onChat = Boolean(conversationId);

  useEffect(() => {
    setActiveWorkspaceId(activeId);
    setRealtimeScope(workspaceMatch, conversationId);
  }, [activeId, setActiveWorkspaceId, workspaceMatch, conversationId]);

  useEffect(() => {
    void api.heartbeat();
    const id = window.setInterval(() => {
      void api.heartbeat();
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const realtimeEnabled = Boolean(process.env.NEXT_PUBLIC_REALTIME_WS_URL);

  return (
    <div className="flex min-h-full flex-col">
      {realtimeEnabled ? <InboxRealtime userId={user.id} /> : null}
      {realtimeEnabled && workspaceMatch ? (
        <WorkspaceEvents workspaceId={workspaceMatch} />
      ) : null}
      {realtimeEnabled ? (
        <InboxEvents userId={user.id} activeConversationId={conversationId} />
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1">
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div
        className={`fixed inset-y-0 left-0 z-40 flex bg-canvas transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${onChat && !open ? "max-md:hidden" : ""}`}
      >
        <WorkspaceRail
          workspaces={workspaces}
          activeId={activeId}
          onNavigate={() => setOpen(false)}
        />
        <ConversationSidebar
          mode={mode}
          workspaceId={workspaceMatch ?? undefined}
          currentUserId={user.id}
          onNavigate={() => setOpen(false)}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-dashed border-hairline px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="border border-dashed border-hairline px-3 py-1.5 text-sm text-ink md:hidden"
          >
            Menu
          </button>
          <Image
            src="/logo-light.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 dark:hidden"
          />
          <Image
            src="/logo-dark.png"
            alt=""
            width={28}
            height={28}
            className="hidden h-7 w-7 dark:block"
          />
          <p className="font-display text-sm font-bold tracking-[-0.04em] uppercase">
            Noirly Pulse
          </p>
          <button
            type="button"
            onClick={() => useUIStore.getState().setCommandPaletteOpen(true)}
            className="ml-auto hidden border border-dashed border-hairline px-3 py-1.5 font-mono text-sm text-muted sm:block"
          >
            ⌘K
          </button>
          <div className="ml-auto flex items-center gap-3 sm:ml-0">
            <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm text-ink">{user.displayName}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <div className="hidden sm:block">
              <SignOutButton />
            </div>
          </div>
        </header>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        <div className="border-t border-dashed border-hairline p-3 sm:hidden">
          <SignOutButton />
        </div>
      </div>
      <CommandPalette workspaces={workspaces} currentUserId={user.id} />
      </div>
    </div>
  );
}
