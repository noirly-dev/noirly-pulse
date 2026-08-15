import { ChatView } from "@/src/features/chat/ChatView";
import { getSyncProvider } from "@/src/server/api/http";

type Params = { params: Promise<{ workspaceId: string; channelId: string; messageId: string }> };

export default async function MobileThreadPage({ params }: Params) {
  const { workspaceId, channelId, messageId } = await params;
  const { ctx, sync } = await getSyncProvider();
  const members = await sync.listMembers(workspaceId);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col md:hidden">
      <ChatView
        conversationId={channelId}
        currentUserId={ctx.userId}
        displayName={ctx.displayName}
        avatarUrl={ctx.avatarUrl}
        threadParentId={messageId}
        workspaceId={workspaceId}
        backHref={`/w/${workspaceId}/channel/${channelId}`}
        mentionCandidates={members.map((row) => row.user)}
      />
    </div>
  );
}
