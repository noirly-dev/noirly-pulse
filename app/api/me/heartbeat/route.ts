import { getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

export async function POST() {
  try {
    const { sync } = await getSyncProvider();
    await sync.heartbeat();
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
