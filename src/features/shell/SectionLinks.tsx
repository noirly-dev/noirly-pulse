"use client";

import Link from "next/link";
import { cn } from "@/src/lib/cn";

type Props = {
  links: Array<{ href: string; label: string; active: boolean }>;
  onNavigate?: () => void;
};

/**
 * Compact wrap-row of section links above the conversation list, so the list
 * keeps the sidebar's vertical space.
 */
export function SectionLinks({ links, onNavigate }: Props) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-1 gap-y-0.5 border-b border-[var(--hairline)] px-2 pb-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onNavigate}
          aria-current={link.active ? "page" : undefined}
          className={cn(
            "px-1.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em]",
            link.active
              ? "text-[var(--accent)]"
              : "text-muted-foreground hover:text-[var(--foreground)]",
          )}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
