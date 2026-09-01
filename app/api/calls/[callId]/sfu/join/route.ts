import { assertObjectId, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

type Params = { params: Promise<{ callId: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { callId } = await params;
    await assertObjectId(callId, "callId");
    const { sync } = await getSyncProvider();
    const room = await sync.sfuJoin(callId);
    return jsonOk(room);
  } catch (error) {
    return jsonError(error);
  }
}
