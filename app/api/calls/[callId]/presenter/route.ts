import { setCallPresenterSchema } from "@/src/core/models/schemas";
import { ApiError, assertObjectId, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

type Params = { params: Promise<{ callId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { callId } = await params;
    await assertObjectId(callId, "callId");
    const body = setCallPresenterSchema.parse(await request.json());
    if (body.userId) await assertObjectId(body.userId, "userId");
    const { sync } = await getSyncProvider();
    const call = await sync.setCallPresenter(callId, body.userId);
    return jsonOk({ call });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
