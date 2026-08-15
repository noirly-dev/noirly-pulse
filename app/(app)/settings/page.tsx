import { NotificationSettings } from "@/src/features/settings/NotificationSettings";
import { getSyncProvider } from "@/src/server/api/http";

export default async function SettingsPage() {
  const { ctx, sync } = await getSyncProvider();
  const user = await sync.getMe();

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 px-6 py-10">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#737373]">
          Account
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Settings</h1>
      </div>
      <dl className="space-y-3 rounded-xl border border-np-border bg-np-surface p-5 text-sm">
        <div>
          <dt className="text-[#737373]">Name</dt>
          <dd className="mt-1 text-[#F5F5F5]">{ctx.displayName}</dd>
        </div>
        <div>
          <dt className="text-[#737373]">Email</dt>
          <dd className="mt-1 text-[#F5F5F5]">{ctx.email}</dd>
        </div>
        <div>
          <dt className="text-[#737373]">Default notification mode</dt>
          <dd className="mt-1 capitalize text-[#F5F5F5]">{user.defaultNotificationPref}</dd>
        </div>
      </dl>
      <NotificationSettings />
    </main>
  );
}
