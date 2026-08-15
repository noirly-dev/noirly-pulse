import { createConversationSchema } from "@/src/core/models/schemas";
import { ApiError, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

export async function GET() {
  try {
    const { sync } = await getSyncProvider();
    const conversations = await sync.listConversations({
      kind: ["dm", "group_dm"],
    });
    return jsonOk({ conversations });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createConversationSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    const conversation =
      body.kind === "dm"
        ? await sync.createDm(body.userId)
        : await sync.createGroupDm({ userIds: body.userIds, name: body.name });
    return jsonOk({ conversation }, 201);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
