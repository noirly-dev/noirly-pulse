"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { PulseBusyScreen } from "@/src/components/PulseBusyScreen";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/inbox";
}

function LoginPopupInner() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  useEffect(() => {
    void signIn(
      "noirly",
      {
        redirectTo: `/login/popup-complete?next=${encodeURIComponent(next)}`,
        callbackUrl: `/login/popup-complete?next=${encodeURIComponent(next)}`,
      },
      { display: "popup", prompt: "select_account" },
    );
  }, [next]);

  return <PulseBusyScreen label="Signing in to Pulse" />;
}

export default function LoginPopupPage() {
  return (
    <Suspense fallback={<PulseBusyScreen label="Signing in to Pulse" />}>
      <LoginPopupInner />
    </Suspense>
  );
}
