import { PageContainer } from "@noirly-dev/ui";

/** Instant feedback on sidebar clicks while the RSC payload resolves. */
export default function AppLoading() {
  return (
    <PageContainer size="xl" className="animate-pulse">
      <div className="h-3 w-24 rounded bg-[var(--surface-2)]" />
      <div className="mt-3 h-8 w-56 max-w-full rounded bg-[var(--surface-2)]" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-28 rounded-[var(--r-lg)] bg-[var(--surface-2)]" />
        <div className="h-28 rounded-[var(--r-lg)] bg-[var(--surface-2)]" />
        <div className="h-28 rounded-[var(--r-lg)] bg-[var(--surface-2)]" />
      </div>
      <div className="mt-4 h-64 rounded-[var(--r-lg)] bg-[var(--surface-2)]" />
    </PageContainer>
  );
}
