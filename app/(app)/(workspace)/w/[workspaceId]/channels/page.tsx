import { ChannelDirectory } from "@/src/features/channels/ChannelDirectory";

type Params = { params: Promise<{ workspaceId: string }> };

export default async function ChannelDirectoryPage({ params }: Params) {
  const { workspaceId } = await params;
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <ChannelDirectory workspaceId={workspaceId} />
    </div>
  );
}
