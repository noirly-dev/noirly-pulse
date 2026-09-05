"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { DEFAULT_THEME_ID } from "@noirly-dev/ui";
import { FaviconTheme } from "@/src/components/FaviconTheme";
import { ThemeProvider } from "@/src/components/ThemeProvider";
import { PulseRealtimeProvider } from "@/src/features/realtime/PulseRealtimeProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider defaultThemeId={DEFAULT_THEME_ID}>
      <FaviconTheme />
      <QueryClientProvider client={client}>
        <PulseRealtimeProvider>{children}</PulseRealtimeProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
