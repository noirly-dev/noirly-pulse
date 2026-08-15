import { addChannelMembersSchema } from "@/src/core/models/schemas";
import {
  ApiError,
  assertObjectId,
  getSyncProvider,
  jsonError,
  jsonOk,
} from "@/src/server/api/http";

type Params = { params: Promise<{ conversationId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { conversationId } = await params;
    await assertObjectId(conversationId, "conversationId");
    const body = addChannelMembersSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    await sync.addChannelMembers(conversationId, body.userIds);
    return jsonOk({ ok: true }, 201);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
