import { assertObjectId, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

type Params = { params: Promise<{ callId: string; consumerId: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { callId, consumerId } = await params;
    await assertObjectId(callId, "callId");
    const { sync } = await getSyncProvider();
    await sync.sfuResumeConsumer(callId, consumerId);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
