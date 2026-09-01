import { createCallSchema } from "@/src/core/models/schemas";
import { ApiError, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

export async function POST(request: Request) {
  try {
    const body = createCallSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    const call = await sync.createCall(body);
    return jsonOk({ call }, 201);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
