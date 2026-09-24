import { ChatView } from "@/src/features/chat/ChatView";
import { getSyncProvider } from "@/src/server/api/http";

type Params = { params: Promise<{ dmId: string; messageId: string }> };

/** Full-screen thread for narrow viewports and shareable deep links (§7.2). */
export default async function DirectMessageThreadPage({ params }: Params) {
  const { dmId, messageId } = await params;
  const { ctx } = await getSyncProvider();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <ChatView
        conversationId={dmId}
        currentUserId={ctx.userId}
        displayName={ctx.displayName}
        avatarUrl={ctx.avatarUrl}
        threadParentId={messageId}
        backHref={`/dm/${dmId}`}
      />
    </div>
  );
}
