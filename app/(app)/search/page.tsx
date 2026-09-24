import { Suspense } from "react";
import { SearchPanel } from "@/src/features/search/SearchPanel";
import { getSyncProvider } from "@/src/server/api/http";

/** Personal-scope search: DMs + group DMs (§12.1). */
export default async function PersonalSearchPage() {
  const { ctx } = await getSyncProvider();
  return (
    <Suspense>
      <SearchPanel currentUserId={ctx.userId} />
    </Suspense>
  );
}
