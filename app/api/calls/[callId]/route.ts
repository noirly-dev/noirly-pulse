import { assertObjectId, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

type Params = { params: Promise<{ callId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { callId } = await params;
    await assertObjectId(callId, "callId");
    const { sync } = await getSyncProvider();
    const call = await sync.getCall(callId);
    return jsonOk({ call });
  } catch (error) {
    return jsonError(error);
  }
}
