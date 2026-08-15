"use client";

type Props = {
  status: "reconnecting" | "closed";
};

export function ConnectionBanner({ status }: Props) {
  return (
    <div
      role="status"
      className="border-b border-np-warning bg-np-warning-muted px-4 py-2 text-center text-sm text-np-warning"
    >
      {status === "reconnecting"
        ? "Reconnecting to Pulse…"
        : "Connection lost. Messages still send over the network; live updates will resume shortly."}
    </div>
  );
}
