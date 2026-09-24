"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * App-wide shortcuts (§11.7). Cmd/Ctrl+K lives in CommandPalette, Cmd/Ctrl+Shift+A
 * in ChatView, and R / E / + on a focused message in MessageBubble.
 *
 * - Alt+↑ / Alt+↓: previous / next DM or channel in the sidebar
 * - `/`: focus search (outside inputs)
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        const links = Array.from(
          document.querySelectorAll<HTMLAnchorElement>(
            '[data-conversation-nav] a[href^="/dm/"], [data-conversation-nav] a[href*="/channel/"]',
          ),
        );
        if (links.length === 0) return;
        event.preventDefault();
        const current = links.findIndex((link) => pathname.startsWith(link.pathname));
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next =
          current === -1
            ? step === 1
              ? 0
              : links.length - 1
            : (current + step + links.length) % links.length;
        router.push(links[next].pathname);
        return;
      }

      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isTyping(event.target)) return;
        event.preventDefault();
        const onSearch = document.querySelector<HTMLInputElement>('input[aria-label="Search messages"]');
        if (onSearch) {
          onSearch.focus();
          return;
        }
        const workspace = /^\/w\/([^/]+)/.exec(pathname)?.[1];
        router.push(workspace ? `/w/${workspace}/search` : "/search");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, pathname]);

  return null;
}
