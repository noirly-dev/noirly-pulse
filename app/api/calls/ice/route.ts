import { mintIceServers } from "@/src/server/calls/ice";
import { jsonError, jsonOk, requirePulseSession } from "@/src/server/api/http";

export async function GET() {
  try {
    const ctx = await requirePulseSession();
    return jsonOk({ iceServers: mintIceServers(ctx.userId) });
  } catch (error) {
    return jsonError(error);
  }
}
