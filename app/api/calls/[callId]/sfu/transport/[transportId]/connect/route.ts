import { sfuConnectTransportSchema } from "@/src/core/models/schemas";
import { ApiError, assertObjectId, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

type Params = { params: Promise<{ callId: string; transportId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { callId, transportId } = await params;
    await assertObjectId(callId, "callId");
    const body = sfuConnectTransportSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    await sync.sfuConnectTransport(callId, transportId, body.dtlsParameters);
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
