import { createWorkspaceSchema } from "@/src/core/models/schemas";
import { ApiError, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

export async function GET() {
  try {
    const { sync } = await getSyncProvider();
    const workspaces = await sync.listWorkspaces();
    return jsonOk({ workspaces });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createWorkspaceSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    const workspace = await sync.createWorkspace({ name: body.name });
    return jsonOk({ workspace }, 201);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
