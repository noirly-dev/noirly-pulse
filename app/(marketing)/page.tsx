import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { DotMatrixNumeral } from "@/src/components/DotMatrix";
import { NoirlyLoginButton } from "@/src/features/auth/NoirlyLoginButton";
import { ensurePulseAccount } from "@/src/server/auth/bootstrap";

export const metadata: Metadata = {
  title: "Noirly Pulse",
  description:
    "Realtime messaging for Noirly — channels, DMs, threads, and presence.",
};

const features = [
  {
    index: "01",
    title: "Channels",
    copy: "Workspace channels for team conversation.",
  },
  {
    index: "02",
    title: "DMs",
    copy: "Direct messages that stay personal and fast.",
  },
  {
    index: "03",
    title: "Threads",
    copy: "Keep side discussions off the main feed.",
  },
  {
    index: "04",
    title: "Realtime",
    copy: "Messages and presence land as they happen.",
  },
  {
    index: "05",
    title: "Identity",
    copy: "Sign in once with Noirly Identity — email or Google.",
  },
  {
    index: "06",
    title: "Search",
    copy: "Find people and messages across workspaces.",
  },
];

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) {
    await ensurePulseAccount({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    });
    redirect("/inbox");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between gap-6 border-b border border-[var(--hairline)] px-5 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <Image
            src="/logo-light.png"
            alt=""
            width={48}
            height={48}
            className="h-11 w-11 border border border-[var(--hairline)] dark:hidden md:h-12 md:w-12"
            priority
          />
          <Image
            src="/logo-dark.png"
            alt=""
            width={48}
            height={48}
            className="hidden h-11 w-11 border border border-[var(--hairline)] dark:block md:h-12 md:w-12"
            priority
          />
          <p className="font-display text-lg font-bold tracking-[-0.04em] uppercase md:text-2xl">
            Noirly Pulse
          </p>
        </div>
        <Link
          href="/login"
          className="font-mono text-[11px] font-semibold tracking-[0.16em] uppercase transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          Sign in
        </Link>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="pointer-events-none hidden w-10 shrink-0 items-center justify-center border-r border border-[var(--hairline)] lg:flex">
          <span className="font-mono text-[10px] font-medium tracking-[0.28em] uppercase [writing-mode:vertical-rl] rotate-180">
            pulse.noirly.com
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <section className="relative overflow-hidden px-5 py-12 md:px-12 md:py-20">
            <div className="mb-8 flex items-center gap-5">
              <Image
                src="/logo-light.png"
                alt=""
                width={96}
                height={96}
                className="h-20 w-20 border border border-[var(--hairline)] dark:hidden md:h-24 md:w-24"
                priority
              />
              <Image
                src="/logo-dark.png"
                alt=""
                width={96}
                height={96}
                className="hidden h-20 w-20 border border border-[var(--hairline)] dark:block md:h-24 md:w-24"
                priority
              />
              <div>
                <p className="font-mono text-[11px] tracking-[0.22em] uppercase text-muted-foreground">
                  Messaging 1.0
                </p>
                <p className="mt-2 font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
                  Connect. Converse. Continue.
                </p>
              </div>
            </div>
            <h1 className="text-perforated mt-4 max-w-[10ch] font-display text-[18vw] leading-[0.8] font-bold tracking-[-0.07em] uppercase md:text-[9rem]">
              Pulse
            </h1>
            <DotMatrixNumeral className="mt-6 block text-5xl md:text-7xl">
              1.0
            </DotMatrixNumeral>
          </section>

          <section className="bg-[var(--surface-2)] px-5 py-10 text-[var(--accent-ink)] md:px-12 md:py-14">
            <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--accent-ink)]/50">
              Team chat
            </p>
            <p className="mt-4 max-w-2xl font-display text-2xl leading-snug font-medium tracking-[-0.03em] md:text-4xl">
              Channels, DMs, threads, and presence for Noirly products — signed
              in through Noirly Identity.
            </p>
            <div className="mt-8 flex max-w-sm flex-col gap-3">
              <NoirlyLoginButton redirectTo="/inbox" />
              <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-[var(--accent-ink)]/50">
                Opens Identity in a secure popup
              </p>
            </div>
          </section>

          <section className="relative border-t border border-[var(--hairline)]">
            <div className="relative min-h-[200px] w-full bg-[var(--surface)] md:min-h-[280px]">
              <Image
                src="/feature-light.png"
                alt="Noirly Pulse"
                fill
                className="object-contain p-8 dark:hidden md:p-12"
                sizes="100vw"
                priority
              />
              <Image
                src="/feature-dark.png"
                alt="Noirly Pulse"
                fill
                className="hidden object-contain p-8 dark:block md:p-12"
                sizes="100vw"
                priority
              />
            </div>
          </section>

          <section className="grid gap-0 border-t border border-[var(--hairline)] md:grid-cols-2 xl:grid-cols-3">
            {features.map((item) => (
              <div
                key={item.index}
                className="flex min-h-44 flex-col justify-between gap-6 border-b border-r border border-[var(--hairline)] px-5 py-8 md:px-8"
              >
                <DotMatrixNumeral className="text-3xl">{item.index}</DotMatrixNumeral>
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">
                    {item.title}
                  </h2>
                  <p className="mt-1 font-mono text-[11px] tracking-[0.08em] uppercase opacity-60">
                    {item.copy}
                  </p>
                </div>
              </div>
            ))}
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border border-[var(--hairline)] px-5 py-6 font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground md:px-12">
            <span className="flex items-center gap-3">
              <Image
                src="/logo-light.png"
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 dark:hidden"
              />
              <Image
                src="/logo-dark.png"
                alt=""
                width={28}
                height={28}
                className="hidden h-7 w-7 dark:block"
              />
              Noirly Pulse
            </span>
            <span>Channels / DMs / Threads</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
