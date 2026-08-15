import { readFile } from "node:fs/promises";
import { Types } from "mongoose";
import { ApiError, jsonError, requirePulseSession } from "@/src/server/api/http";
import { withDb } from "@/src/server/db/mongodb";
import { ConversationMember, Message, Upload } from "@/src/server/models";

type Params = { params: Promise<{ uploadId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const ctx = await requirePulseSession();
    const { uploadId } = await params;
    if (!Types.ObjectId.isValid(uploadId)) {
      throw new ApiError(400, "invalid_request", "Invalid upload");
    }

    const file = await withDb(async () => {
      const upload = await Upload.findById(uploadId).lean();
      if (!upload) throw new ApiError(404, "not_found", "Upload not found");
      if (upload.userId.toString() === ctx.userId) return upload;

      const message = await Message.findOne({
        "attachments.id": uploadId,
      }).lean();
      if (!message) throw new ApiError(404, "not_found", "Upload not found");
      const member = await ConversationMember.findOne({
        conversationId: message.conversationId,
        userId: new Types.ObjectId(ctx.userId),
      }).lean();
      if (!member) throw new ApiError(404, "not_found", "Upload not found");
      return upload;
    });

    const bytes = await readFile(file.storagePath);
    return new Response(bytes, {
      headers: {
        "content-type": file.mime,
        "content-disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
