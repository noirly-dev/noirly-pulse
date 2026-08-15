import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/src/components/AppShell";
import { getSyncProvider } from "@/src/server/api/http";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { ctx, sync } = await getSyncProvider();
  const workspaces = await sync.listWorkspaces();

  return (
    <AppShell
      user={{
        id: ctx.userId,
        displayName: ctx.displayName,
        email: ctx.email,
        avatarUrl: ctx.avatarUrl,
      }}
      workspaces={workspaces}
    >
      {children}
    </AppShell>
  );
}
