import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader } from "@noirly-dev/ui";
import { WorkspaceSettingsForm } from "@/src/features/workspace/WorkspaceSettingsForm";
import { getSyncProvider } from "@/src/server/api/http";

type Params = { params: Promise<{ workspaceId: string }> };

export default async function WorkspaceSettingsPage({ params }: Params) {
  const { workspaceId } = await params;
  const { sync } = await getSyncProvider();
  const workspace = await sync.getWorkspace(workspaceId);
  if (workspace.kind !== "team") notFound();

  return (
    <PageContainer size="md" className="space-y-6 py-10">
      <PageHeader kicker="Workspace" title="Settings" lead={`Your role: ${workspace.role}`} />
      <WorkspaceSettingsForm workspaceId={workspaceId} name={workspace.name} slug={workspace.slug} />
      <p className="text-sm text-muted-foreground">
        Invite people and change roles on the{" "}
        <Link href={`/w/${workspaceId}/members`} className="underline">
          Members
        </Link>{" "}
        page.
      </p>
    </PageContainer>
  );
}
