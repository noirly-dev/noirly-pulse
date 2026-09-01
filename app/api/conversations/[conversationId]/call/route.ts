import { assertObjectId, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

type Params = { params: Promise<{ conversationId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { conversationId } = await params;
    await assertObjectId(conversationId, "conversationId");
    const { sync } = await getSyncProvider();
    const call = await sync.getActiveCall(conversationId);
    return jsonOk({ call });
  } catch (error) {
    return jsonError(error);
  }
}
