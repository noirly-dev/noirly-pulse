"use client";

import Link from "next/link";
import { cn } from "@/src/lib/cn";
import { Badge } from "@/src/ui/Badge";
import type { WorkspaceSummary } from "@/src/core/models/types";
import { CreateTeamWorkspace } from "@/src/features/workspace/CreateTeamWorkspace";

function glyph(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "P";
}

type Props = {
  workspaces: WorkspaceSummary[];
  activeId: "personal" | string;
  onNavigate?: () => void;
};

export function WorkspaceRail({ workspaces, activeId, onNavigate }: Props) {
  const personal = workspaces.find((w) => w.kind === "personal");
  const teams = workspaces.filter((w) => w.kind === "team");

  return (
    <nav
      aria-label="Workspaces"
      className="relative flex w-16 shrink-0 flex-col items-center gap-2 border-r border-dashed border-hairline bg-canvas py-3"
    >
      <Link
        href="/"
        onClick={onNavigate}
        aria-label="Noirly Pulse"
        className="mb-1 flex size-10 items-center justify-center border border-dashed border-hairline"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-light.png" alt="" className="size-10 dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-dark.png" alt="" className="hidden size-10 dark:block" />
      </Link>
      <Link
        href="/inbox"
        onClick={onNavigate}
        aria-label="Personal"
        aria-current={activeId === "personal" ? "page" : undefined}
        className={cn(
          "relative flex size-10 items-center justify-center text-sm font-semibold",
          activeId === "personal"
            ? "bg-ink text-canvas"
            : "bg-surface text-ink hover:bg-ink hover:text-canvas",
        )}
      >
        {glyph(personal?.name ?? "P")}
        {personal && personal.unreadCount > 0 ? (
          <Badge className="absolute -right-1 -top-1 min-w-4 px-1">
            {personal.unreadCount > 99 ? "99+" : personal.unreadCount}
          </Badge>
        ) : null}
      </Link>

      <div className="h-px w-8 border-t border-dashed border-hairline" />

      {teams.map((workspace) => {
        const active = activeId === workspace.id;
        return (
          <Link
            key={workspace.id}
            href={`/w/${workspace.id}`}
            onClick={onNavigate}
            aria-label={workspace.name}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex size-10 items-center justify-center text-sm font-semibold",
              active
                ? "bg-ink text-canvas"
                : "bg-surface text-ink hover:bg-ink hover:text-canvas",
            )}
          >
            {glyph(workspace.name)}
            {workspace.unreadCount > 0 ? (
              <Badge className="absolute -right-1 -top-1 min-w-4 px-1">
                {workspace.unreadCount > 99 ? "99+" : workspace.unreadCount}
              </Badge>
            ) : null}
          </Link>
        );
      })}

      <CreateTeamWorkspace />
    </nav>
  );
}
