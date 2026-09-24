import Link from "next/link";
import { PageContainer } from "@noirly-dev/ui";
import { ChannelDirectory } from "@/src/features/channels/ChannelDirectory";
import { getSyncProvider } from "@/src/server/api/http";

type Params = { params: Promise<{ workspaceId: string }> };

export default async function WorkspaceHomePage({ params }: Params) {
  const { workspaceId } = await params;
  const { sync } = await getSyncProvider();
  const workspace = await sync.getWorkspace(workspaceId);

  if (workspace.kind === "personal") {
    return (
      <PageContainer size="md">
        <p className="text-sm text-muted-foreground">
          This personal workspace is a home icon only. Direct messages live under Personal.
        </p>
      </PageContainer>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="border-b border-[var(--hairline)] px-4 py-4 sm:px-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {workspace.name}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Pick a channel, check your{" "}
          <Link href={`/w/${workspaceId}/inbox`} className="underline decoration-dashed underline-offset-4">
            inbox
          </Link>{" "}
          or{" "}
          <Link href={`/w/${workspaceId}/search`} className="underline decoration-dashed underline-offset-4">
            search messages
          </Link>
          .
        </p>
      </div>
      <ChannelDirectory workspaceId={workspaceId} />
    </div>
  );
}
