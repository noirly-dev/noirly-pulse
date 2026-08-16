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
    <div className="flex min-h-dvh">
      {realtimeEnabled ? <InboxRealtime userId={user.id} /> : null}
      {realtimeEnabled && workspaceMatch ? (
        <WorkspaceEvents workspaceId={workspaceMatch} />
      ) : null}
      {realtimeEnabled ? (
        <InboxEvents userId={user.id} activeConversationId={conversationId} />
      ) : null}

      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-ink/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh flex-col border-r border-dashed border-hairline bg-canvas transition-transform md:sticky md:top-0 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${onChat && !open ? "max-md:hidden" : ""}`}
      >
        <div className="border-b border-dashed border-hairline px-5 py-5">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-light.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 border border-dashed border-hairline dark:hidden"
              priority
            />
            <Image
              src="/logo-dark.png"
              alt=""
              width={40}
              height={40}
              className="hidden h-10 w-10 border border-dashed border-hairline dark:block"
              priority
            />
            <p className="font-display text-lg font-bold tracking-[-0.04em] uppercase">
              Noirly Pulse
            </p>
          </div>
          <button
            type="button"
            onClick={() => useUIStore.getState().setCommandPaletteOpen(true)}
            className="mt-3 flex w-full cursor-pointer items-center justify-between border border-dashed border-hairline px-3 py-2 text-left text-sm text-muted hover:bg-ink hover:text-canvas"
          >
            <span>Search</span>
            <span className="font-mono text-[10px]">⌘K</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
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

        <div className="mt-auto shrink-0 border-t border-dashed border-hairline px-4 py-4">
          <p className="truncate text-sm">{user.displayName}</p>
          <p className="truncate font-mono text-[11px] text-muted">{user.email}</p>
          <div className="mt-3">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-dashed border-hairline px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="cursor-pointer border border-dashed border-hairline px-3 py-1.5 text-sm"
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
            Pulse
          </p>
          <button
            type="button"
            onClick={() => useUIStore.getState().setCommandPaletteOpen(true)}
            className="ml-auto cursor-pointer border border-dashed border-hairline px-3 py-1.5 font-mono text-sm text-muted"
          >
            ⌘K
          </button>
        </header>
        <div className="min-h-0 min-w-0 flex-1">{children}</div>
      </div>
      <CommandPalette workspaces={workspaces} currentUserId={user.id} />
    </div>
  );
}
