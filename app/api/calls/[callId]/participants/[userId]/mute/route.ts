import { assertObjectId, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

type Params = { params: Promise<{ callId: string; userId: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { callId, userId: targetUserId } = await params;
    await assertObjectId(callId, "callId");
    await assertObjectId(targetUserId, "userId");
    const { sync } = await getSyncProvider();
    const call = await sync.muteCallParticipant(callId, targetUserId);
    return jsonOk({ call });
  } catch (error) {
    return jsonError(error);
  }
}
