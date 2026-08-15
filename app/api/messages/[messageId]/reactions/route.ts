import { toggleReactionSchema } from "@/src/core/models/schemas";
import {
  ApiError,
  assertObjectId,
  getSyncProvider,
  jsonError,
  jsonOk,
} from "@/src/server/api/http";

type Params = { params: Promise<{ messageId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { messageId } = await params;
    await assertObjectId(messageId, "messageId");
    const body = toggleReactionSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    const result = await sync.toggleReaction(messageId, body.emoji);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
