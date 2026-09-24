import { createInviteSchema } from "@/src/core/models/schemas";
import {
  ApiError,
  assertObjectId,
  getSyncProvider,
  jsonError,
  jsonOk,
} from "@/src/server/api/http";

type Params = { params: Promise<{ workspaceId: string }> };

/**
 * Email invite (§4.3). Existing Pulse users are added immediately; anyone else
 * is added on their first Pulse sign-in with that email.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { workspaceId } = await params;
    await assertObjectId(workspaceId, "workspaceId");
    const body = createInviteSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    const invite = await sync.createInvite(workspaceId, body);
    return jsonOk({ invite }, 201);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
