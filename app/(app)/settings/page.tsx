import { PageContainer, PageHeader } from "@noirly-dev/ui";
import { NotificationSettings } from "@/src/features/settings/NotificationSettings";
import { getSyncProvider } from "@/src/server/api/http";

export default async function SettingsPage() {
  const { ctx, sync } = await getSyncProvider();
  const user = await sync.getMe();

  return (
    <PageContainer size="md" className="py-10">
      <PageHeader
        kicker="Account"
        title="Settings"
        lead="Notification preferences and account details."
      />
      <dl className="space-y-3 border border-[var(--hairline)] bg-[var(--surface)] p-5 text-sm">
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
    </PageContainer>
  );
}
