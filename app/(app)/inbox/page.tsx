import { InboxList } from "@/src/features/inbox/InboxList";
import { getSyncProvider } from "@/src/server/api/http";

export default async function InboxPage() {
  const { ctx } = await getSyncProvider();
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <InboxList currentUserId={ctx.userId} />
    </div>
  );
}
