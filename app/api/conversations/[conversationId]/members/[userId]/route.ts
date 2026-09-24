import { assertObjectId, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

type Params = { params: Promise<{ conversationId: string; userId: string }> };

/** Remove someone from a private channel (admin+), or leave it yourself. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { conversationId, userId } = await params;
    await assertObjectId(conversationId, "conversationId");
    await assertObjectId(userId, "userId");
    const { sync } = await getSyncProvider();
    await sync.removeChannelMember(conversationId, userId);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
