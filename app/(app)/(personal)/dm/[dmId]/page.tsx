import { ChatWithThreads } from "@/src/features/threads/ChatWithThreads";
import { getSyncProvider } from "@/src/server/api/http";

type Params = {
  params: Promise<{ dmId: string }>;
  searchParams: Promise<{ thread?: string }>;
};

export default async function DirectMessagePage({ params, searchParams }: Params) {
  const { dmId } = await params;
  const { thread } = await searchParams;
  const { ctx } = await getSyncProvider();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <ChatWithThreads
        conversationId={dmId}
        basePath={`/dm/${dmId}`}
        backHref="/inbox"
        currentUserId={ctx.userId}
        displayName={ctx.displayName}
        avatarUrl={ctx.avatarUrl}
        threadId={thread ?? null}
      />
    </div>
  );
}
