import { pushSubscribeSchema } from "@/src/core/models/schemas";
import {
  ApiError,
  getSyncProvider,
  jsonError,
  jsonOk,
} from "@/src/server/api/http";

export async function POST(request: Request) {
  try {
    const body = pushSubscribeSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    await sync.subscribePush({
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: request.headers.get("user-agent"),
    });
    return jsonOk({ ok: true }, 201);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { endpoint?: string };
    if (!body.endpoint) {
      return jsonError(new ApiError(400, "invalid_request", "Missing endpoint"));
    }
    const { sync } = await getSyncProvider();
    await sync.unsubscribePush(body.endpoint);
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
