import { updateMemberRoleSchema } from "@/src/core/models/schemas";
import {
  ApiError,
  assertObjectId,
  getSyncProvider,
  jsonError,
  jsonOk,
} from "@/src/server/api/http";

type Params = { params: Promise<{ workspaceId: string; userId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { workspaceId, userId: targetUserId } = await params;
    await assertObjectId(workspaceId, "workspaceId");
    await assertObjectId(targetUserId, "userId");
    const body = updateMemberRoleSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    await sync.updateMemberRole(workspaceId, targetUserId, body.role);
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { workspaceId, userId: targetUserId } = await params;
    await assertObjectId(workspaceId, "workspaceId");
    await assertObjectId(targetUserId, "userId");
    const { sync } = await getSyncProvider();
    await sync.removeMember(workspaceId, targetUserId);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
