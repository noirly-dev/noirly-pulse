import { getSyncProvider } from "@/src/server/api/http";
import { WorkspaceMembersPanel } from "@/src/features/workspace/WorkspaceMembersPanel";

type Params = { params: Promise<{ workspaceId: string }> };

export default async function WorkspaceMembersPage({ params }: Params) {
  const { workspaceId } = await params;
  const { ctx } = await getSyncProvider();

  return (
    <WorkspaceMembersPanel workspaceId={workspaceId} currentUserId={ctx.userId} />
  );
}
