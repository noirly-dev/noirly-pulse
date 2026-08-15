import { getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const { sync } = await getSyncProvider();
    const users = await sync.searchUsers(q);
    return jsonOk({ users });
  } catch (error) {
    return jsonError(error);
  }
}
