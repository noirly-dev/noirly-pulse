"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/src/lib/cn";

const LINKS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/preferences", label: "Preferences" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="flex gap-1 border-b border-[var(--hairline)]">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "px-3 py-2 text-sm",
              active
                ? "border-b-2 border-[var(--accent)] text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
