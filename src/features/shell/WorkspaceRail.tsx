"use client";

import Link from "next/link";
import { cn } from "@/src/lib/cn";
import { Badge } from "@noirly-dev/ui";
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
      className="relative flex w-16 shrink-0 flex-col items-center gap-2 border-r border border-[var(--hairline)] bg-background py-3"
    >
      <Link
        href="/inbox"
        onClick={onNavigate}
        aria-label="Personal"
        aria-current={activeId === "personal" ? "page" : undefined}
        className={cn(
          "relative flex size-10 items-center justify-center text-sm font-semibold",
          activeId === "personal"
            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
            : "text-muted-foreground hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
        )}
      >
        {glyph(personal?.name ?? "P")}
        {personal && personal.unreadCount > 0 ? (
          <Badge className="absolute -right-1 -top-1 min-w-4 px-1">
            {personal.unreadCount > 99 ? "99+" : personal.unreadCount}
          </Badge>
        ) : null}
      </Link>

      <div className="h-px w-8 border-t border border-[var(--hairline)]" />

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
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-muted-foreground hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
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
