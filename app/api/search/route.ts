import { getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const conversationId = url.searchParams.get("conversationId") ?? undefined;
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const { sync } = await getSyncProvider();
    const result = await sync.searchMessages({ q, workspaceId, conversationId, cursor });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
