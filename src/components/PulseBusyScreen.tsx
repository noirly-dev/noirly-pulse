export function PulseBusyScreen({ label }: { label: string }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-5 px-6">
        <span className="busy-dots font-mono text-4xl font-bold tracking-[0.45em] text-ink">
          ···
        </span>
        <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-muted">
          {label}
        </p>
      </div>
    </div>
  );
}
