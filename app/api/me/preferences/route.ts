import { updatePreferencesSchema } from "@/src/core/models/schemas";
import { getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

export async function PATCH(request: Request) {
  try {
    const body = updatePreferencesSchema.parse(await request.json());
    const { sync } = await getSyncProvider();
    const user = await sync.updatePreferences(body);
    return jsonOk({ user });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(error);
    }
    return jsonError(error);
  }
}
