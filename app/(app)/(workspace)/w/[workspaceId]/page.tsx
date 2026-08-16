import Link from "next/link";
import { getSyncProvider } from "@/src/server/api/http";
import { WorkspaceSearchPanel } from "@/src/features/workspace/WorkspaceSearchPanel";

type Params = { params: Promise<{ workspaceId: string }> };

export default async function WorkspaceHomePage({ params }: Params) {
  const { workspaceId } = await params;
  const { sync } = await getSyncProvider();
  const workspace = await sync.getWorkspace(workspaceId);

  if (workspace.kind === "personal") {
    return (
      <div className="p-6 text-sm text-muted">
        This personal workspace is a home icon only. Direct messages live under Personal.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-dashed border-hairline px-6 py-4">
        <h1 className="font-display text-2xl font-bold tracking-[-0.04em] uppercase">{workspace.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a channel from the sidebar or{" "}
          <Link href={`/w/${workspaceId}/search`} className="underline decoration-dashed underline-offset-4">
            search messages
          </Link>
          .
        </p>
      </div>
      <WorkspaceSearchPanel workspaceId={workspaceId} />
    </div>
  );
}
