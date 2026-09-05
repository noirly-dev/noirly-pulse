"use client";

import Link from "next/link";
import { BrandMark } from "@/src/components/BrandMark";
import { ThemeControls } from "@/src/components/ThemeControls";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--hairline)] bg-[var(--bg)]/70 backdrop-blur-xl">
      <div className="shell flex h-16 items-center justify-between gap-6">
        <Link href="/" className="focusable flex items-center gap-2.5 rounded-[var(--r-sm)]">
          <BrandMark className="h-8 w-8" />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-sm font-semibold tracking-tight">Noirly</span>
            <span className="meta text-[0.625rem]">Pulse</span>
          </span>
        </Link>
        <ThemeControls />
      </div>
    </header>
  );
}
