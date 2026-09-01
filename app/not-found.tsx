export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-3 px-6 py-16">
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
        Noirly Pulse
      </p>
      <h1 className="text-perforated mt-2 font-display text-5xl font-bold tracking-[-0.05em] uppercase">
        Not found
      </h1>
      <p className="text-sm text-muted-foreground">
        That page, workspace, or conversation does not exist, or you do not have access.
      </p>
    </main>
  );
}
