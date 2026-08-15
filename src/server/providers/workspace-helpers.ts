import { createHash, randomBytes } from "node:crypto";
import { Types } from "mongoose";
import type { ChannelVisibility, MemberRole } from "@/src/core/models/enums";
import type { Channel } from "@/src/core/models/types";
import { can, type PermissionAction } from "@/src/core/permissions/can";
import { canViewConversation } from "@/src/core/permissions/visibility";
import { ApiError } from "@/src/server/api/http";
import { mapConversation } from "@/src/server/mappers";
import {
  Conversation,
  ConversationMember,
  Invite,
  Message,
  PulseUser,
  WorkspaceMember,
} from "@/src/server/models";
import { pulseChannel } from "@/src/core/realtime/channels";
import { publishRealtime } from "@/src/server/realtime/publish";

export function oid(id: string) {
  return new Types.ObjectId(id);
}

export function slugifyChannel(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "channel";
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newInviteToken(): string {
  return randomBytes(24).toString("hex");
}

export async function requireWorkspaceMember(
  userId: string,
  workspaceId: string,
): Promise<MemberRole> {
  const membership = await WorkspaceMember.findOne({
    workspaceId: oid(workspaceId),
    userId: oid(userId),
  }).lean();
  if (!membership) {
    throw new ApiError(403, "forbidden", "Not a member of this workspace");
  }
  return membership.role as MemberRole;
}

export function requirePermission(role: MemberRole, action: PermissionAction): void {
  if (!can(role, action)) {
    throw new ApiError(403, "forbidden", "Insufficient permissions");
  }
}

export async function loadChannelOrThrow(conversationId: string) {
  const conversation = await Conversation.findById(conversationId).lean();
  if (!conversation || conversation.archivedAt || conversation.kind !== "channel") {
    throw new ApiError(404, "not_found", "Channel not found");
  }
  return conversation;
}

export async function accessibleChannelIds(
  userId: string,
  workspaceId: string,
): Promise<string[]> {
  await requireWorkspaceMember(userId, workspaceId);
  const publicRows = await Conversation.find({
    workspaceId: oid(workspaceId),
    kind: "channel",
    visibility: "public",
    archivedAt: null,
  })
    .select("_id")
    .lean();
  const privateMemberships = await ConversationMember.find({
    userId: oid(userId),
  })
    .select("conversationId")
    .lean();
  const privateIds = privateMemberships.map((m) => m.conversationId);
  const privateRows =
    privateIds.length > 0
      ? await Conversation.find({
          _id: { $in: privateIds },
          workspaceId: oid(workspaceId),
          kind: "channel",
          visibility: "private",
          archivedAt: null,
        })
          .select("_id")
          .lean()
      : [];
  const ids = new Set<string>();
  for (const row of [...publicRows, ...privateRows]) {
    ids.add(row._id.toString());
  }
  return [...ids];
}

export async function ensureConversationMember(
  userId: string,
  conversationId: string,
): Promise<void> {
  const user = await PulseUser.findById(userId).select("defaultNotificationPref").lean();
  await ConversationMember.findOneAndUpdate(
    { conversationId: oid(conversationId), userId: oid(userId) },
    {
      $setOnInsert: {
        joinedAt: new Date(),
        notifications: user?.defaultNotificationPref ?? "all",
      },
    },
    { upsert: true },
  );
}

export async function conversationAccessContext(userId: string, conversationId: string) {
  const conversation = await Conversation.findById(conversationId).lean();
  if (!conversation || conversation.archivedAt) {
    throw new ApiError(404, "not_found", "Conversation not found");
  }
  const convMember = await ConversationMember.findOne({
    conversationId: conversation._id,
    userId: oid(userId),
  }).lean();
  let isWorkspaceMember = false;
  let workspaceRole: MemberRole | null = null;
  if (conversation.workspaceId) {
    const membership = await WorkspaceMember.findOne({
      workspaceId: conversation.workspaceId,
      userId: oid(userId),
    }).lean();
    isWorkspaceMember = Boolean(membership);
    workspaceRole = (membership?.role as MemberRole) ?? null;
  }
  const visible = canViewConversation({
    kind: conversation.kind,
    visibility: conversation.visibility ?? null,
    isWorkspaceMember,
    isConversationMember: Boolean(convMember),
  });
  if (!visible) {
    throw new ApiError(404, "not_found", "Conversation not found");
  }
  return { conversation, convMember, isWorkspaceMember, workspaceRole };
}

export async function countUnreadInConversation(
  userId: string,
  conversationId: string,
): Promise<number> {
  const membership = await ConversationMember.findOne({
    conversationId: oid(conversationId),
    userId: oid(userId),
  }).lean();
  const filter: Record<string, unknown> = {
    conversationId: oid(conversationId),
    senderId: { $ne: oid(userId) },
    deletedAt: null,
    threadParentId: null,
  };
  if (membership?.lastReadAt) {
    filter.createdAt = { $gt: membership.lastReadAt };
  }
  return Message.countDocuments(filter);
}

export async function countWorkspaceUnread(
  userId: string,
  workspaceId: string,
): Promise<number> {
  const channelIds = await accessibleChannelIds(userId, workspaceId);
  let total = 0;
  for (const id of channelIds) {
    total += await countUnreadInConversation(userId, id);
  }
  return total;
}

export async function acceptPendingInvites(userId: string, email: string): Promise<void> {
  const pending = await Invite.find({
    email: email.trim().toLowerCase(),
    acceptedAt: null,
    expiresAt: { $gt: new Date() },
  }).lean();
  for (const invite of pending) {
    const exists = await WorkspaceMember.findOne({
      workspaceId: invite.workspaceId,
      userId: oid(userId),
    }).lean();
    if (!exists) {
      await WorkspaceMember.create({
        workspaceId: invite.workspaceId,
        userId: oid(userId),
        role: invite.role,
      });
      await publishRealtime({
        channel: pulseChannel.workspace(invite.workspaceId.toString()),
        event: "member.joined",
        data: { userId, role: invite.role },
      });
    }
    await Invite.findByIdAndUpdate(invite._id, { acceptedAt: new Date() });
  }
}

export function asChannel(
  conversation: Parameters<typeof mapConversation>[0],
): Channel {
  const mapped = mapConversation(conversation);
  if (mapped.kind !== "channel" || !mapped.workspaceId || !mapped.name || !mapped.slug) {
    throw new ApiError(500, "internal_error", "Invalid channel document");
  }
  return {
    ...mapped,
    kind: "channel",
    workspaceId: mapped.workspaceId,
    name: mapped.name,
    slug: mapped.slug,
    visibility: (mapped.visibility ?? "public") as ChannelVisibility,
    dmKey: null,
  };
}
