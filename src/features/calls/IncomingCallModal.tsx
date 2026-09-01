"use client";

import { useEffect } from "react";
import { callMediaLabel } from "@/src/core/calls/copy";
import { Button } from "@noirly-dev/ui";
import { LiveRegion } from "@/src/components/LiveRegion";
import { useCallStore } from "@/src/stores/call-store";

export function IncomingCallModal({ userId }: { userId: string }) {
  const incoming = useCallStore((s) => s.incoming);
  const status = useCallStore((s) => s.status);
  const acceptIncoming = useCallStore((s) => s.acceptIncoming);
  const declineIncoming = useCallStore((s) => s.declineIncoming);
  const expireIfNeeded = useCallStore((s) => s.expireIfNeeded);
  const permissionError = useCallStore((s) => s.permissionError);

  useEffect(() => {
    if (status !== "ringing-in") return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") void declineIncoming();
    }
    window.addEventListener("keydown", onKey);
    const id = window.setInterval(() => {
      void expireIfNeeded();
    }, 1000);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearInterval(id);
    };
  }, [status, declineIncoming, expireIfNeeded]);

  if (status !== "ringing-in" || !incoming) return null;

  const label = `Incoming ${callMediaLabel(incoming.type)}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-call-canvas/80" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="incoming-call-title"
        className="relative z-10 w-full max-w-md border border-dashed border-white/20 bg-call-elevated p-6 text-call-ink"
      >
        <LiveRegion message={`${label} from ${incoming.initiatedByName}`} />
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-call-accent">
          Incoming
        </p>
        <h2 id="incoming-call-title" className="mt-2 font-display text-2xl font-bold uppercase tracking-[-0.04em]">
          {incoming.initiatedByName}
        </h2>
        <p className="mt-1 text-sm text-white/60">{label}</p>
        {permissionError ? (
          <p className="mt-3 text-sm text-call-warning">{permissionError.message}. Allow access and accept again.</p>
        ) : null}
        <div className="mt-6 flex gap-3">
          <Button
            variant="ghost"
            className="flex-1 border-white/25 text-call-ink hover:bg-white hover:text-call-canvas"
            onClick={() => void declineIncoming()}
          >
            Decline
          </Button>
          <Button
            className="flex-1 bg-call-accent text-call-accent-fg hover:opacity-90"
            autoFocus
            onClick={() => void acceptIncoming(userId)}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
