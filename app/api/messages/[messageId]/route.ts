import { editMessageSchema } from "@/src/core/models/schemas";
import {
  ApiError,
  assertObjectId,
  getSyncProvider,
  jsonError,
  jsonOk,
} from "@/src/server/api/http";

type Params = { params: Promise<{ messageId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { messageId } = await params;
    await assertObjectId(messageId, "messageId");
    const body = editMessageSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    const message = await sync.editMessage(messageId, body.content);
    return jsonOk({ message });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { messageId } = await params;
    await assertObjectId(messageId, "messageId");
    const { sync } = await getSyncProvider();
    const message = await sync.deleteMessage(messageId);
    return jsonOk({ message });
  } catch (error) {
    return jsonError(error);
  }
}
