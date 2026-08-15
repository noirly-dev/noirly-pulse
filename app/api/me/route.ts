import { getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

export async function GET() {
  try {
    const { ctx, sync } = await getSyncProvider();
    const user = await sync.getMe();
    return jsonOk({
      user: {
        id: ctx.userId,
        email: ctx.email,
        displayName: ctx.displayName,
        identitySub: ctx.identitySub,
        avatarUrl: ctx.avatarUrl,
        lastSeenAt: user.lastSeenAt,
        defaultNotificationPref: user.defaultNotificationPref,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
