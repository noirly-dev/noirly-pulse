import { updateChannelSchema } from "@/src/core/models/schemas";
import {
  ApiError,
  assertObjectId,
  getSyncProvider,
  jsonError,
  jsonOk,
} from "@/src/server/api/http";

type Params = { params: Promise<{ conversationId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { conversationId } = await params;
    await assertObjectId(conversationId, "conversationId");
    const { sync } = await getSyncProvider();
    const conversation = await sync.getConversation(conversationId);
    return jsonOk({ conversation });
  } catch (error) {
    return jsonError(error);
  }
}

/** Rename / set topic / change visibility (channels, admin+). */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { conversationId } = await params;
    await assertObjectId(conversationId, "conversationId");
    const body = updateChannelSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    const channel = await sync.updateChannel(conversationId, body);
    return jsonOk({ channel });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}

/** Archive a channel (admin+). Channels are archived, never hard-deleted. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { conversationId } = await params;
    await assertObjectId(conversationId, "conversationId");
    const { sync } = await getSyncProvider();
    await sync.archiveChannel(conversationId);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
