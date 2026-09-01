"use client";

export function CallReconnectBanner() {
  return (
    <div
      role="status"
      className="border-b border-dashed border-call-warning/40 bg-call-warning/10 px-4 py-2 text-center text-sm text-call-warning"
    >
      Reconnecting…
    </div>
  );
}
