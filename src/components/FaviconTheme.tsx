"use client";

import { useEffect } from "react";

const FAVICON = {
  light: "/brand-mark-light.svg",
  dark: "/brand-mark-dark.svg",
} as const;

function isDarkMode() {
  return document.documentElement.classList.contains("dark");
}

function faviconHref(isDark: boolean) {
  return isDark ? FAVICON.dark : FAVICON.light;
}

/** Keeps the tab icon in sync with the manual theme toggle (not just system preference). */
export function FaviconTheme() {
  useEffect(() => {
    function sync() {
      const href = faviconHref(isDarkMode());
      let link = document.querySelector<HTMLLinkElement>(
        'link[rel="icon"][data-theme-sync="true"]',
      );
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        link.type = "image/svg+xml";
        link.setAttribute("data-theme-sync", "true");
        document.head.appendChild(link);
      }
      link.href = href;
    }

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
