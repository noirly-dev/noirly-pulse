import type { Metadata } from "next";
import { ThemeStyles, noirlyFontClassName } from "@noirly-dev/ui";
import { AppProviders } from "@/src/components/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "Noirly Pulse",
  description: "Messaging for the Noirly ecosystem",
  icons: {
    icon: [
      {
        url: "/logo-dark.png",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/logo-light.png",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
    ],
    apple: "/logo-dark.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${noirlyFontClassName} dark h-full`}
      data-theme="gold"
      suppressHydrationWarning
    >
      <head>
        <ThemeStyles themeId="gold" />
      </head>
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
