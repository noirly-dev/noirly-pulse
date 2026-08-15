export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-3 px-6 py-16">
      <p className="font-mono text-xs tracking-[0.2em] text-np-accent">NOIRLY PULSE</p>
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="text-sm text-[#A3A3A3]">
        That page, workspace, or conversation does not exist, or you do not have access.
      </p>
    </main>
  );
}
