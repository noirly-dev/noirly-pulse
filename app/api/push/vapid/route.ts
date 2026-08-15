import { vapidPublicKey } from "@/src/server/push/send";
import { jsonOk } from "@/src/server/api/http";

export async function GET() {
  return jsonOk({ publicKey: vapidPublicKey() });
}
