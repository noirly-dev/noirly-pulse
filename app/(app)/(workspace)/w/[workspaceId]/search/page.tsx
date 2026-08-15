import { WorkspaceSearchPanel } from "@/src/features/workspace/WorkspaceSearchPanel";

type Params = { params: Promise<{ workspaceId: string }> };

export default async function WorkspaceSearchPage({ params }: Params) {
  const { workspaceId } = await params;
  return <WorkspaceSearchPanel workspaceId={workspaceId} />;
}
