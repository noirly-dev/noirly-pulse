import type { Metadata } from "next";
import { NoirlyHead, noirlyFontClassName } from "@noirly-dev/ui";
import { NoirlyExperience } from "@noirly-dev/ui/experience";
import { AppProviders } from "@/src/components/AppProviders";
import { PULSE_LOGO_URL } from "@/src/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: "Noirly Pulse",
  description: "Messaging for the Noirly ecosystem",
  icons: {
    icon: [{ url: PULSE_LOGO_URL, type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark h-full"
      data-theme="gold"
      suppressHydrationWarning
    >
      <head>
        <NoirlyHead themeId="gold" />
      </head>
      <body className={`${noirlyFontClassName} flex min-h-dvh flex-col antialiased`}>
        <NoirlyExperience mark="Noirly Pulse" pageTransition={false}>
          <AppProviders>{children}</AppProviders>
        </NoirlyExperience>
      </body>
    </html>
  );
}
