import { assertObjectId, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

type Params = { params: Promise<{ callId: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { callId } = await params;
    await assertObjectId(callId, "callId");
    const { sync } = await getSyncProvider();
    const call = await sync.leaveCall(callId);
    return jsonOk({ call });
  } catch (error) {
    return jsonError(error);
  }
}
