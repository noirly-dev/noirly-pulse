import { sendMessageSchema } from "@/src/core/models/schemas";
import {
  ApiError,
  assertObjectId,
  getSyncProvider,
  jsonError,
  jsonOk,
} from "@/src/server/api/http";

type Params = { params: Promise<{ conversationId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { conversationId } = await params;
    await assertObjectId(conversationId, "conversationId");
    const url = new URL(request.url);
    const { sync } = await getSyncProvider();
    const page = await sync.listMessages(conversationId, {
      before: url.searchParams.get("before") ?? undefined,
      after: url.searchParams.get("after") ?? undefined,
      anchorMessageId: url.searchParams.get("anchorMessageId") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 50) || 50,
      threadParentId: url.searchParams.get("threadParentId"),
    });
    return jsonOk(page);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { conversationId } = await params;
    await assertObjectId(conversationId, "conversationId");
    const body = sendMessageSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    const message = await sync.sendMessage({
      conversationId,
      content: body.content,
      clientNonce: body.clientNonce,
      attachmentIds: body.attachmentIds,
      threadParentId: body.threadParentId,
    });
    return jsonOk({ message }, 201);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
