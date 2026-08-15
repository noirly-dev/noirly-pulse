import { jsonOk } from "@/src/server/api/http";

export async function GET() {
  return jsonOk({ ok: true, service: "noirly-pulse" });
}
