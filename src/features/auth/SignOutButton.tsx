"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "next-auth/react";
import { PulseBusyScreen } from "@/src/components/PulseBusyScreen";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut({ callbackUrl: "/login", redirect: true });
    } catch {
      window.location.assign("/login");
    }
  }

  return (
    <>
      {busy
        ? createPortal(<PulseBusyScreen label="Signing out" />, document.body)
        : null}
      <button
        className="w-full cursor-pointer border border border-[var(--hairline)] px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        type="button"
        onClick={() => void onSignOut()}
        disabled={busy}
      >
        Sign out
      </button>
    </>
  );
}
