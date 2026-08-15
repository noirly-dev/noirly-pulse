import type { Metadata } from "next";
import Image from "next/image";
import { NoirlyLoginButton } from "@/src/features/auth/NoirlyLoginButton";
import { DotMatrixClock } from "@/src/components/DotMatrix";

export const metadata: Metadata = {
  title: "Sign in · Noirly Pulse",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const redirectTo =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/inbox";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-dashed border-hairline px-5 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <Image
            src="/logo-light.png"
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 border border-dashed border-hairline dark:hidden"
            priority
          />
          <Image
            src="/logo-dark.png"
            alt=""
            width={44}
            height={44}
            className="hidden h-11 w-11 border border-dashed border-hairline dark:block"
            priority
          />
          <p className="font-display text-lg font-bold tracking-[-0.04em] uppercase md:text-2xl">
            Noirly Pulse
          </p>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="pointer-events-none hidden w-10 shrink-0 items-center justify-center border-r border-dashed border-hairline lg:flex">
          <span className="font-mono text-[10px] font-medium tracking-[0.28em] uppercase [writing-mode:vertical-rl] rotate-180">
            Pulse
          </span>
        </div>
        <section className="flex flex-1 flex-col justify-between gap-12 px-5 py-10 md:px-12 md:py-16">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted">
              Workspace
            </p>
            <h1 className="text-perforated mt-4 font-display text-5xl leading-[0.9] font-bold tracking-[-0.05em] uppercase md:text-7xl">
              Sign in to Pulse
            </h1>
            <p className="mt-6 max-w-md text-base text-muted">
              Use your Noirly account. Email, Google, and verification are
              handled by Noirly Identity.
            </p>
          </div>
          <DotMatrixClock className="text-6xl md:text-8xl" />
        </section>
        <section className="flex w-full flex-col justify-center gap-6 bg-panel px-5 py-10 text-panel-ink md:px-12 md:py-16 lg:w-[42%] lg:max-w-xl">
          <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-panel-ink/55">
            Continue
          </p>
          <NoirlyLoginButton redirectTo={redirectTo} />
        </section>
      </div>
    </div>
  );
}
