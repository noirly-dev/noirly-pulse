import { sfuConsumerLayersSchema } from "@/src/core/models/schemas";
import { ApiError, assertObjectId, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

type Params = { params: Promise<{ callId: string; consumerId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { callId, consumerId } = await params;
    await assertObjectId(callId, "callId");
    const body = sfuConsumerLayersSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    await sync.sfuSetConsumerLayers(callId, consumerId, body);
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
