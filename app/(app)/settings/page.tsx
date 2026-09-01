import { NotificationSettings } from "@/src/features/settings/NotificationSettings";
import { getSyncProvider } from "@/src/server/api/http";

export default async function SettingsPage() {
  const { ctx, sync } = await getSyncProvider();
  const user = await sync.getMe();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-10">
      <div>
        <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
          Account
        </p>
        <h1 className="text-perforated mt-2 font-display text-5xl font-bold tracking-[-0.05em] uppercase">
          Settings
        </h1>
      </div>
      <dl className="space-y-3 border border border-[var(--hairline)] bg-[var(--surface)] p-5 text-sm">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Name</dt>
          <dd className="mt-1 text-foreground">{ctx.displayName}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Email</dt>
          <dd className="mt-1 text-foreground">{ctx.email}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Default notification mode
          </dt>
          <dd className="mt-1 capitalize text-foreground">{user.defaultNotificationPref}</dd>
        </div>
      </dl>
      <NotificationSettings />
    </main>
  );
}
