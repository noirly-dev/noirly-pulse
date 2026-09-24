import { Suspense } from "react";
import { SearchPanel } from "@/src/features/search/SearchPanel";
import { getSyncProvider } from "@/src/server/api/http";

type Params = { params: Promise<{ workspaceId: string }> };

export default async function WorkspaceSearchPage({ params }: Params) {
  const { workspaceId } = await params;
  const { ctx } = await getSyncProvider();
  return (
    <Suspense>
      <SearchPanel workspaceId={workspaceId} currentUserId={ctx.userId} />
    </Suspense>
  );
}
