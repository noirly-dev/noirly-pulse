import { markReadSchema } from "@/src/core/models/schemas";
import {
  ApiError,
  assertObjectId,
  getSyncProvider,
  jsonError,
  jsonOk,
} from "@/src/server/api/http";

type Params = { params: Promise<{ conversationId: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const { conversationId } = await params;
    await assertObjectId(conversationId, "conversationId");
    const body = markReadSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    const receipt = await sync.markRead(conversationId, body.lastReadMessageId);
    return jsonOk({ receipt });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
