import { createChannelSchema } from "@/src/core/models/schemas";
import {
  ApiError,
  assertObjectId,
  getSyncProvider,
  jsonError,
  jsonOk,
} from "@/src/server/api/http";

type Params = { params: Promise<{ workspaceId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { workspaceId } = await params;
    await assertObjectId(workspaceId, "workspaceId");
    const { sync } = await getSyncProvider();
    const channels = await sync.listConversations({
      kind: ["channel"],
      workspaceId,
    });
    return jsonOk({ channels });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { workspaceId } = await params;
    await assertObjectId(workspaceId, "workspaceId");
    const body = createChannelSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    const channel = await sync.createChannel({
      workspaceId,
      name: body.name,
      visibility: body.visibility,
      topic: body.topic,
    });
    return jsonOk({ channel }, 201);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
