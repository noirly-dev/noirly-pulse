"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppShell as NoirlyAppShell, SidebarBrand } from "@noirly-dev/ui";
import type { WorkspaceSummary } from "@/src/core/models/types";
import { CallMediaProvider } from "@/src/features/calls/CallMediaProvider";
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

const pulseLogo = (
  <>
    <Image
      src="/logo-light.png"
      alt=""
      width={40}
      height={40}
      className="h-full w-full rounded-lg border border-[var(--hairline)] dark:hidden"
      priority
    />
    <Image
      src="/logo-dark.png"
      alt=""
      width={40}
      height={40}
      className="hidden h-full w-full rounded-lg border border-[var(--hairline)] dark:block"
      priority
    />
  </>
);

export function AppShell({ user, workspaces, children }: Props) {
  const pathname = usePathname();
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId);

  const workspaceMatch = pathname.startsWith("/w/") ? pathname.split("/")[2] : null;
  const dmMatch = pathname.startsWith("/dm/") ? (pathname.split("/")[2] ?? null) : null;
  const channelMatch =
    workspaceMatch && pathname.includes("/channel/")
      ? (pathname.split("/channel/")[1]?.split("/")[0] ?? null)
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
    <>
      {realtimeEnabled ? <InboxRealtime userId={user.id} /> : null}
      {realtimeEnabled && workspaceMatch ? (
        <WorkspaceEvents workspaceId={workspaceMatch} />
      ) : null}
      {realtimeEnabled ? (
        <InboxEvents userId={user.id} activeConversationId={conversationId} />
      ) : null}
      <CallMediaProvider
        userId={user.id}
        displayName={user.displayName}
        avatarUrl={user.avatarUrl}
      >
        <NoirlyAppShell
          contentClassName={
            onChat ? "h-full min-h-0 flex flex-col overflow-hidden p-0" : undefined
          }
          sidebar={{
            className:
              "w-auto max-w-none [&>nav]:hidden [&>div:nth-child(2)]:flex [&>div:nth-child(2)]:min-h-0 [&>div:nth-child(2)]:flex-1 [&>div:nth-child(2)]:overflow-hidden [&>div:nth-child(2)]:shrink",
            brand: (
              <div className="space-y-3">
                <SidebarBrand logo={pulseLogo} title="Noirly Pulse" />
                <button
                  type="button"
                  onClick={() => useUIStore.getState().setCommandPaletteOpen(true)}
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-3 py-2 text-left text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                >
                  <span>Search</span>
                  <span className="font-mono text-[10px]">⌘K</span>
                </button>
              </div>
            ),
            children: (
              <div className="flex min-h-0 flex-1">
                <WorkspaceRail
                  workspaces={workspaces}
                  activeId={activeId}
                  onNavigate={() => undefined}
                />
                <ConversationSidebar
                  mode={mode}
                  workspaceId={workspaceMatch ?? undefined}
                  currentUserId={user.id}
                  onNavigate={() => undefined}
                />
              </div>
            ),
            items: [],
            footer: (
              <div>
                <p className="truncate text-sm text-[var(--foreground)]">{user.displayName}</p>
                <p className="truncate font-mono text-[11px] text-[var(--muted-foreground)]">
                  {user.email}
                </p>
                <div className="mt-3">
                  <SignOutButton />
                </div>
              </div>
            ),
          }}
          header={{
            brand: (
              <div className="flex items-center gap-3">
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
                <p className="font-display text-sm font-semibold tracking-tight">Pulse</p>
              </div>
            ),
            actions: (
              <button
                type="button"
                onClick={() => useUIStore.getState().setCommandPaletteOpen(true)}
                className="cursor-pointer rounded-lg border border-[var(--hairline)] px-3 py-1.5 font-mono text-sm text-[var(--muted-foreground)]"
              >
                ⌘K
              </button>
            ),
          }}
        >
          {children}
        </NoirlyAppShell>
        <CommandPalette workspaces={workspaces} currentUserId={user.id} />
      </CallMediaProvider>
    </>
  );
}
