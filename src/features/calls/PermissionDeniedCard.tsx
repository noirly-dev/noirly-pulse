"use client";

import type { PermissionErrorKind } from "@/src/features/calls/permissions";
import { Button } from "@noirly-dev/ui";

const copy: Record<PermissionErrorKind, { title: string; body: string }> = {
  mic: {
    title: "Microphone blocked",
    body: "Allow microphone access for this site in your browser settings, then try again. Chrome: Site settings → Microphone. Firefox: Permissions in the address bar. Safari: Settings → Websites → Microphone.",
  },
  camera: {
    title: "Camera blocked",
    body: "Allow camera access for this site in your browser settings, then try again. You can still join with audio if the microphone is allowed.",
  },
  screen: {
    title: "Screen share blocked",
    body: "You cancelled the picker, or this browser blocked screen share. Start the share again from a click in Pulse.",
  },
};

export function PermissionDeniedCard({
  kind,
  message,
  onRetry,
  onDismiss,
}: {
  kind: PermissionErrorKind;
  message?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const text = copy[kind];
  return (
    <div className="max-w-md border border-dashed border-call-warning/50 bg-call-elevated p-5 text-call-ink">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-call-warning">Permission</p>
      <h2 className="mt-2 font-display text-xl font-bold uppercase tracking-[-0.04em]">{text.title}</h2>
      <p className="mt-2 text-sm text-white/65">{message && message !== "Permission denied" ? message : text.body}</p>
      <div className="mt-4 flex gap-2">
        {onRetry ? (
          <Button className="bg-call-accent text-call-accent-fg hover:opacity-90" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        {onDismiss ? (
          <Button variant="ghost" className="border-white/25 text-call-ink" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}
