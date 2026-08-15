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
      <div className="p-6 text-sm text-[#737373]">
        This personal workspace is a home icon only. Direct messages live under Personal.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-np-border px-6 py-4">
        <h1 className="text-lg font-semibold">{workspace.name}</h1>
        <p className="mt-1 text-sm text-[#737373]">
          Pick a channel from the sidebar or{" "}
          <Link href={`/w/${workspaceId}/search`} className="text-np-accent underline">
            search messages
          </Link>
          .
        </p>
      </div>
      <WorkspaceSearchPanel workspaceId={workspaceId} />
    </div>
  );
}
