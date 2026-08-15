import { ChatView } from "@/src/features/chat/ChatView";
import { getSyncProvider } from "@/src/server/api/http";

type Params = { params: Promise<{ dmId: string }> };

export default async function DirectMessagePage({ params }: Params) {
  const { dmId } = await params;
  const { ctx } = await getSyncProvider();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <ChatView
        conversationId={dmId}
        currentUserId={ctx.userId}
        displayName={ctx.displayName}
        avatarUrl={ctx.avatarUrl}
      />
    </div>
  );
}
