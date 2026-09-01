import { Types } from "mongoose";
import { pulseChannel } from "@/src/core/realtime/channels";
import {
  ApiError,
  jsonError,
  jsonOk,
  requirePulseSession,
} from "@/src/server/api/http";
import { withDb } from "@/src/server/db/mongodb";
import { Conversation, ConversationMember, WorkspaceMember } from "@/src/server/models";
import { canViewConversation } from "@/src/core/permissions/visibility";
import { signRealtimeJwt } from "@/src/server/realtime/jwt";
import { accessibleChannelIds } from "@/src/server/providers/workspace-helpers";
import { listLiveCallCaps } from "@/src/server/providers/call-service";

export async function GET(request: Request) {
  try {
    const ctx = await requirePulseSession();
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const conversationId = url.searchParams.get("conversationId");
    const callId = url.searchParams.get("callId");

    const caps = await withDb(async () => {
      const next: Record<string, Array<"subscribe" | "publish" | "presence">> = {
        [pulseChannel.inbox(ctx.userId)]: ["subscribe"],
      };

      const memberships = await WorkspaceMember.find({
        userId: new Types.ObjectId(ctx.userId),
      }).lean();

      for (const membership of memberships) {
        next[pulseChannel.workspace(membership.workspaceId.toString())] = [
          "subscribe",
          "presence",
        ];
      }

      const convMemberships = await ConversationMember.find({
        userId: new Types.ObjectId(ctx.userId),
      })
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();
      for (const membership of convMemberships) {
        const id = membership.conversationId.toString();
        next[pulseChannel.conv(id)] = ["subscribe", "presence"];
        next[pulseChannel.typing(id)] = ["subscribe", "publish"];
      }

      if (workspaceId) {
        if (!Types.ObjectId.isValid(workspaceId)) {
          throw new ApiError(400, "invalid_request", "Invalid workspaceId");
        }
        const allowed = memberships.some(
          (m) => m.workspaceId.toString() === workspaceId,
        );
        if (!allowed) {
          throw new ApiError(403, "forbidden", "Not a member of this workspace");
        }
        const channelIds = await accessibleChannelIds(ctx.userId, workspaceId);
        for (const id of channelIds) {
          next[pulseChannel.conv(id)] = ["subscribe", "presence"];
          next[pulseChannel.typing(id)] = ["subscribe", "publish"];
        }
      }

      if (conversationId) {
        if (!Types.ObjectId.isValid(conversationId)) {
          throw new ApiError(400, "invalid_request", "Invalid conversationId");
        }
        const conversation = await Conversation.findById(conversationId).lean();
        if (!conversation || conversation.archivedAt) {
          throw new ApiError(404, "not_found", "Conversation not found");
        }
        const convMember = await ConversationMember.findOne({
          conversationId: conversation._id,
          userId: new Types.ObjectId(ctx.userId),
        }).lean();
        const isWorkspaceMember = conversation.workspaceId
          ? memberships.some(
              (m) => m.workspaceId.toString() === conversation.workspaceId?.toString(),
            )
          : false;
        const visible = canViewConversation({
          kind: conversation.kind,
          visibility: conversation.visibility ?? null,
          isWorkspaceMember,
          isConversationMember: Boolean(convMember),
        });
        if (!visible) {
          throw new ApiError(404, "not_found", "Conversation not found");
        }
        next[pulseChannel.conv(conversationId)] = ["subscribe", "presence"];
        next[pulseChannel.typing(conversationId)] = ["subscribe", "publish"];
      }

      const liveCallIds = await listLiveCallCaps(ctx.userId);
      for (const id of liveCallIds) {
        next[pulseChannel.call(id)] = ["subscribe", "publish", "presence"];
      }
      if (callId) {
        if (!Types.ObjectId.isValid(callId)) {
          throw new ApiError(400, "invalid_request", "Invalid callId");
        }
        if (liveCallIds.includes(callId)) {
          next[pulseChannel.call(callId)] = ["subscribe", "publish", "presence"];
        }
      }

      return next;
    });

    const { token, expiresIn } = await signRealtimeJwt({
      userId: ctx.userId,
      name: ctx.displayName,
      caps,
    });

    return jsonOk({
      token,
      expiresIn,
      url: process.env.NEXT_PUBLIC_REALTIME_WS_URL ?? null,
    });
  } catch (error) {
    return jsonError(error);
  }
}
