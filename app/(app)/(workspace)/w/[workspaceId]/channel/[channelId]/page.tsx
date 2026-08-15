import { ChannelChatPage } from "@/src/features/channels/ChannelChatPage";
import { getSyncProvider } from "@/src/server/api/http";

type Params = {
  params: Promise<{ workspaceId: string; channelId: string }>;
  searchParams: Promise<{ thread?: string }>;
};

export default async function ChannelPage({ params, searchParams }: Params) {
  const { workspaceId, channelId } = await params;
  const { thread } = await searchParams;
  const { ctx } = await getSyncProvider();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <ChannelChatPage
        workspaceId={workspaceId}
        channelId={channelId}
        currentUserId={ctx.userId}
        displayName={ctx.displayName}
        avatarUrl={ctx.avatarUrl}
        threadId={thread ?? null}
      />
    </div>
  );
}
