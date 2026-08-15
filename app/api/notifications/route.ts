import { markNotificationsReadSchema } from "@/src/core/models/schemas";
import {
  ApiError,
  getSyncProvider,
  jsonError,
  jsonOk,
} from "@/src/server/api/http";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const { sync } = await getSyncProvider();
    const page = await sync.listNotifications(cursor);
    return jsonOk(page);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = markNotificationsReadSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    await sync.markNotificationsRead(body.ids);
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "invalid_request", "Invalid JSON"));
    }
    return jsonError(error);
  }
}
