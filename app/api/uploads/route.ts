import { ApiError, getSyncProvider, jsonError, jsonOk } from "@/src/server/api/http";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "invalid_request", "file is required");
    }
    const { sync } = await getSyncProvider();
    const buffer = Buffer.from(await file.arrayBuffer());
    const attachment = await sync.createUpload({
      filename: file.name || "upload",
      mime: file.type || "application/octet-stream",
      sizeBytes: file.size,
      body: buffer,
    });
    return jsonOk({ attachment }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
