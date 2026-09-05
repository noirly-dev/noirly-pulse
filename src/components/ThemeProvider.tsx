"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyPalette,
  DEFAULT_THEME_ID,
  isValidThemeId,
  NOIRLY_THEMES,
  PALETTE_STORAGE_KEY,
  readStoredPalette,
  type ThemeDefinition,
} from "@noirly-dev/ui";

type ThemeContextValue = {
  paletteId: string;
  setPalette: (id: string) => void;
  themes: ThemeDefinition[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  defaultThemeId = DEFAULT_THEME_ID,
  children,
}: {
  defaultThemeId?: string;
  children: ReactNode;
}) {
  const resolvedDefault = isValidThemeId(defaultThemeId)
    ? defaultThemeId
    : DEFAULT_THEME_ID;
  const [paletteId, setPaletteId] = useState(resolvedDefault);

  const syncPalette = useCallback(
    (id: string) => {
      const next = isValidThemeId(id) ? id : resolvedDefault;
      setPaletteId(next);
      applyPalette(next, undefined, resolvedDefault);
    },
    [resolvedDefault],
  );

  useLayoutEffect(() => {
    syncPalette(readStoredPalette(resolvedDefault));

    function onStorage(event: StorageEvent) {
      if (event.key !== PALETTE_STORAGE_KEY || !event.newValue) return;
      syncPalette(event.newValue);
    }

    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      syncPalette(readStoredPalette(resolvedDefault));
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [resolvedDefault, syncPalette]);

  const setPalette = useCallback(
    (id: string) => {
      if (!isValidThemeId(id)) return;
      syncPalette(id);
      try {
        localStorage.setItem(PALETTE_STORAGE_KEY, id);
      } catch {
        /* private mode */
      }
    },
    [syncPalette],
  );

  const value = useMemo(
    () => ({ paletteId, setPalette, themes: NOIRLY_THEMES }),
    [paletteId, setPalette],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
