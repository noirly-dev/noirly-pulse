import { sfuConsumeSchema } from "@/src/core/models/schemas";
import { ApiError, assertObjectId, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

type Params = { params: Promise<{ callId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { callId } = await params;
    await assertObjectId(callId, "callId");
    const body = sfuConsumeSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    const result = await sync.sfuConsume(callId, body);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
