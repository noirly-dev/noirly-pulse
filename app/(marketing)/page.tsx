import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@noirly-dev/ui";
import { auth } from "@/auth";
import { BrandMark } from "@/src/components/BrandMark";
import { MarketingHeader } from "@/src/components/MarketingHeader";
import { NoirlyLoginButton } from "@/src/features/auth/NoirlyLoginButton";

export const metadata: Metadata = {
  title: "Noirly Pulse",
  description:
    "Realtime messaging for Noirly — channels, DMs, threads, and presence.",
};

const features = [
  {
    title: "Channels",
    copy: "Workspace channels for team conversation.",
  },
  {
    title: "DMs",
    copy: "Direct messages that stay personal and fast.",
  },
  {
    title: "Threads",
    copy: "Keep side discussions off the main feed.",
  },
  {
    title: "Realtime",
    copy: "Messages and presence land as they happen.",
  },
  {
    title: "Noirly Identity",
    copy: "Sign in once with email or Google. No new password to remember.",
  },
  {
    title: "Search",
    copy: "Find people and messages across workspaces.",
  },
];

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) {
    // Proxy also redirects signed-in `/` → `/inbox`; this is the RSC fallback.
    redirect("/inbox");
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <MarketingHeader />

      <main id="main" className="flex flex-1 flex-col">
        <section className="shell section-y">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <BrandMark className="h-20 w-20" />
            <p className="eyebrow mt-7">Messaging &amp; presence</p>
            <h1 className="display-lg mt-4 text-balance">
              Conversation that keeps up with the team.
            </h1>
            <p className="lede mt-5 text-center">
              Channels, DMs, threads, and realtime presence in one Pulse — for you
              alone or for the whole workspace.
            </p>

            <div className="mt-9 w-full max-w-xs">
              <NoirlyLoginButton redirectTo="/inbox" />
            </div>
            <p className="meta mt-4">Opens Noirly Identity in a secure popup</p>
          </div>
        </section>

        <section className="section-rule relative">
          <div className="shell section-y">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow justify-center">What is inside</p>
              <h2 className="display-md mt-4">Built for how teams actually talk</h2>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {features.map((item) => (
                <Card key={item.title} variant="interactive">
                  <CardHeader>
                    <CardTitle>{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="copy">{item.copy}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="section-rule relative">
        <div className="shell flex flex-wrap items-center justify-between gap-4 py-7">
          <span className="flex items-center gap-2.5">
            <BrandMark className="h-6 w-6" />
            <span className="meta">Noirly Pulse</span>
          </span>
          <span className="meta">Channels · DMs · Threads · Realtime</span>
        </div>
      </footer>
    </div>
  );
}
