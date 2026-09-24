import { InboxList } from "@/src/features/inbox/InboxList";
import { getSyncProvider } from "@/src/server/api/http";

type Params = { params: Promise<{ workspaceId: string }> };

export default async function WorkspaceInboxPage({ params }: Params) {
  const { workspaceId } = await params;
  const { ctx } = await getSyncProvider();
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <InboxList currentUserId={ctx.userId} workspaceId={workspaceId} />
    </div>
  );
}
