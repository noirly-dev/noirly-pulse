import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Types, type PipelineStage } from "mongoose";
import type { ChannelVisibility, MemberRole, NotificationKind } from "@/src/core/models/enums";
import type {
  Attachment,
  Channel,
  ConversationPeer,
  ConversationSummary,
  Message,
  Notification,
  User,
} from "@/src/core/models/types";
import type { PulseSyncProvider } from "@/src/core/sync/types";
import { extractMentionedUserIds } from "@/src/core/mentions/extract";
import {
  isConversationMuted,
  shouldDeliverNotification,
} from "@/src/core/notifications/should-notify";
import { sanitizeMessageContent } from "@/src/core/markdown/sanitize";
import { canViewConversation } from "@/src/core/permissions/visibility";
import { can } from "@/src/core/permissions/can";
import { ApiError } from "@/src/server/api/http";
import { withDb } from "@/src/server/db/mongodb";
import {
  mapConversation,
  mapInvite,
  mapMessage,
  mapNotification,
  mapUser,
  mapWorkspace,
  mapWorkspaceMember,
  mapWorkspaceSummary,
} from "@/src/server/mappers";
import {
  Conversation,
  ConversationMember,
  Invite,
  Message as MessageModel,
  Notification as NotificationModel,
  PushSubscription,
  PulseUser,
  Reaction,
  Upload,
  Workspace,
  WorkspaceMember,
} from "@/src/server/models";
import { pulseChannel } from "@/src/core/realtime/channels";
import { publishRealtime } from "@/src/server/realtime/publish";
import { sendPushToUser } from "@/src/server/push/send";
import {
  accessibleChannelIds,
  asChannel,
  countUnreadInConversation,
  countWorkspaceUnread,
  ensureConversationMember,
  conversationAccessContext,
  hashInviteToken,
  newInviteToken,
  oid,
  requirePermission,
  requireWorkspaceMember,
  slugifyChannel,
} from "@/src/server/providers/workspace-helpers";
import {
  acceptCallForUser,
  createCallForUser,
  declineCallForUser,
  endCallForUser,
  getActiveCallForUser,
  getCallForUser,
  joinCallForUser,
  leaveCallForUser,
  markCallConnectedForUser,
  muteParticipantForUser,
  setPresenterForUser,
  sfuConnectTransportForUser,
  sfuConsumeForUser,
  sfuCreateTransportForUser,
  sfuJoinForUser,
  sfuProduceForUser,
  sfuResumeConsumerForUser,
  sfuSetConsumerLayersForUser,
  upgradeCallToSfuForUser,
} from "@/src/server/providers/call-service";

type ProviderContext = { userId: string };

function notImplemented(): never {
  throw new ApiError(501, "not_implemented", "Not available yet");
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "team";
}

function dmKeyFor(a: string, b: string) {
  return [a, b].sort().join(":");
}

function previewOf(content: string) {
  const trimmed = content.replace(/\s+/g, " ").trim();
  return trimmed.slice(0, 140) || "Attachment";
}

async function requireMembership(
  userId: string,
  workspaceId: string,
  minRole: MemberRole = "member",
): Promise<MemberRole> {
  const membership = await WorkspaceMember.findOne({
    workspaceId: oid(workspaceId),
    userId: oid(userId),
  }).lean();

  if (!membership) {
    throw new ApiError(403, "forbidden", "Not a member of this workspace");
  }

  const rank: Record<MemberRole, number> = { member: 1, admin: 2, owner: 3 };
  if (rank[membership.role as MemberRole] < rank[minRole]) {
    throw new ApiError(403, "forbidden", "Insufficient permissions");
  }

  return membership.role as MemberRole;
}

async function assertConversationAccess(userId: string, conversationId: string) {
  const ctx = await conversationAccessContext(userId, conversationId);
  return { conversation: ctx.conversation, convMember: ctx.convMember };
}

async function hydrateReactions(messages: Message[]): Promise<Message[]> {
  if (messages.length === 0) return messages;
  const ids = messages.map((message) => oid(message.id));
  const rows = await Reaction.find({ messageId: { $in: ids } }).lean();
  const byMessage = new Map<string, Map<string, string[]>>();
  for (const row of rows) {
    const messageId = row.messageId.toString();
    const emojiMap = byMessage.get(messageId) ?? new Map<string, string[]>();
    const users = emojiMap.get(row.emoji) ?? [];
    users.push(row.userId.toString());
    emojiMap.set(row.emoji, users);
    byMessage.set(messageId, emojiMap);
  }
  return messages.map((message) => {
    const emojiMap = byMessage.get(message.id);
    return {
      ...message,
      reactions: emojiMap
        ? [...emojiMap.entries()].map(([emoji, userIds]) => ({ emoji, userIds }))
        : [],
    };
  });
}

async function toSummary(
  conversation: Parameters<typeof mapConversation>[0],
  userId: string,
): Promise<ConversationSummary> {
  const memberships = await ConversationMember.find({
    conversationId: conversation._id,
  }).lean();
  const users = await PulseUser.find({
    _id: { $in: memberships.map((m) => m.userId) },
  }).lean();
  const userById = new Map(users.map((user) => [user._id.toString(), user]));
  const mine = memberships.find((m) => m.userId.toString() === userId);
  const members: ConversationPeer[] = memberships.flatMap((membership) => {
    const user = userById.get(membership.userId.toString());
    if (!user) return [];
    return [
      {
        ...mapUser(user),
        lastReadMessageId: membership.lastReadMessageId
          ? membership.lastReadMessageId.toString()
          : null,
        lastReadAt: membership.lastReadAt ? membership.lastReadAt.toISOString() : null,
      },
    ];
  });

  let unreadCount = 0;
  if (mine) {
    const filter: Record<string, unknown> = {
      conversationId: conversation._id,
      senderId: { $ne: oid(userId) },
      deletedAt: null,
    };
    if (mine.lastReadAt) {
      filter.createdAt = { $gt: mine.lastReadAt };
    }
    unreadCount = await MessageModel.countDocuments(filter);
  }

  return {
    ...mapConversation(conversation),
    unreadCount,
    members,
  };
}

async function memberNotificationPref(
  userId: string,
  conversationId: string,
): Promise<{ pref: import("@/src/core/models/enums").NotificationPref; mutedUntil: string | null }> {
  const [member, user] = await Promise.all([
    ConversationMember.findOne({
      conversationId: oid(conversationId),
      userId: oid(userId),
    }).lean(),
    PulseUser.findById(userId).lean(),
  ]);
  return {
    pref: (member?.notifications ??
      user?.defaultNotificationPref ??
      "all") as import("@/src/core/models/enums").NotificationPref,
    mutedUntil: member?.mutedUntil ? member.mutedUntil.toISOString() : null,
  };
}

async function deliverNotification(opts: {
  targetUserId: string;
  kind: NotificationKind;
  conversationId: string;
  messageId: string | null;
  senderId: string;
  workspaceId: string | null;
  inboxEvent: string;
  inboxData: Record<string, unknown>;
  pushTitle: string;
  pushBody: string;
  pushUrl: string;
}) {
  const { pref, mutedUntil } = await memberNotificationPref(
    opts.targetUserId,
    opts.conversationId,
  );
  if (isConversationMuted(mutedUntil) || !shouldDeliverNotification(pref, opts.kind)) {
    return;
  }

  await NotificationModel.create({
    userId: oid(opts.targetUserId),
    kind: opts.kind,
    workspaceId: opts.workspaceId ? oid(opts.workspaceId) : null,
    conversationId: oid(opts.conversationId),
    messageId: opts.messageId ? oid(opts.messageId) : null,
    actorId: oid(opts.senderId),
  });
  if (opts.kind !== "dm") {
    await publishRealtime({
      channel: pulseChannel.inbox(opts.targetUserId),
      event: opts.inboxEvent,
      data: opts.inboxData,
    });
  }
  await sendPushToUser(opts.targetUserId, {
    title: opts.pushTitle,
    body: opts.pushBody,
    url: opts.pushUrl,
  });
}

async function fanoutMessage(opts: {
  conversationId: string;
  message: Message;
  memberIds: string[];
  senderId: string;
  workspaceId: string | null;
  threadParentId: string | null;
  mentionedUserIds: string[];
  conversationKind: import("@/src/core/models/enums").ConversationKind;
  conversationName: string | null;
  conversationSlug: string | null;
  senderName: string;
}) {
  await publishRealtime({
    channel: pulseChannel.conv(opts.conversationId),
    event: "message.sent",
    data: { message: opts.message },
  });
  const preview = previewOf(opts.message.content);
  const recipients = opts.memberIds.filter((id) => id !== opts.senderId);
  const pushUrl =
    opts.workspaceId && opts.conversationKind === "channel"
      ? `/w/${opts.workspaceId}/channel/${opts.conversationId}?msg=${opts.message.id}`
      : `/dm/${opts.conversationId}?msg=${opts.message.id}`;

  await Promise.all(
    recipients.map(async (targetUserId) => {
      await publishRealtime({
        channel: pulseChannel.inbox(targetUserId),
        event: "inbox.message",
        data: {
          conversationId: opts.conversationId,
          messageId: opts.message.id,
          senderId: opts.senderId,
          preview,
          workspaceId: opts.workspaceId,
        },
      });
    }),
  );

  const isDm = opts.conversationKind === "dm" || opts.conversationKind === "group_dm";
  if (isDm && !opts.threadParentId) {
    for (const targetUserId of recipients) {
      await deliverNotification({
        targetUserId,
        kind: "dm",
        conversationId: opts.conversationId,
        messageId: opts.message.id,
        senderId: opts.senderId,
        workspaceId: opts.workspaceId,
        inboxEvent: "inbox.message",
        inboxData: {
          conversationId: opts.conversationId,
          messageId: opts.message.id,
          senderId: opts.senderId,
          preview,
          workspaceId: opts.workspaceId,
        },
        pushTitle: opts.senderName,
        pushBody: preview,
        pushUrl,
      });
    }
  }

  for (const targetUserId of opts.mentionedUserIds) {
    if (targetUserId === opts.senderId) continue;
    const channelLabel = opts.conversationName ?? opts.conversationSlug ?? "channel";
    await deliverNotification({
      targetUserId,
      kind: "mention",
      conversationId: opts.conversationId,
      messageId: opts.message.id,
      senderId: opts.senderId,
      workspaceId: opts.workspaceId,
      inboxEvent: "inbox.mention",
      inboxData: {
        conversationId: opts.conversationId,
        messageId: opts.message.id,
        senderId: opts.senderId,
        workspaceId: opts.workspaceId,
      },
      pushTitle: `${opts.senderName} mentioned you`,
      pushBody: `#${channelLabel}: ${preview}`,
      pushUrl,
    });
  }

  if (opts.threadParentId) {
    const parent = await MessageModel.findById(opts.threadParentId).lean();
    if (parent) {
      const threadFollowers = new Set<string>([
        parent.senderId.toString(),
        ...recipients,
      ]);
      threadFollowers.delete(opts.senderId);
      for (const targetUserId of threadFollowers) {
        await deliverNotification({
          targetUserId,
          kind: "thread_reply",
          conversationId: opts.conversationId,
          messageId: opts.message.id,
          senderId: opts.senderId,
          workspaceId: opts.workspaceId,
          inboxEvent: "inbox.thread_reply",
          inboxData: {
            conversationId: opts.conversationId,
            parentId: opts.threadParentId,
            messageId: opts.message.id,
            senderId: opts.senderId,
          },
          pushTitle: `${opts.senderName} replied in thread`,
          pushBody: preview,
          pushUrl:
            opts.workspaceId && opts.conversationKind === "channel"
              ? `/w/${opts.workspaceId}/channel/${opts.conversationId}/thread/${opts.threadParentId}?msg=${opts.message.id}`
              : `/dm/${opts.conversationId}?thread=${opts.threadParentId}&msg=${opts.message.id}`,
        });
      }
    }
  }
}

export function createMongoSyncProvider({ userId }: ProviderContext): PulseSyncProvider {
  return {
    async getMe() {
      return withDb(async () => {
        const user = await PulseUser.findById(userId).lean();
        if (!user) throw new ApiError(401, "unauthorized", "User not found");
        return mapUser(user);
      });
    },

    async heartbeat() {
      return withDb(async () => {
        await PulseUser.findByIdAndUpdate(userId, { lastSeenAt: new Date() });
      });
    },

    async listWorkspaces() {
      return withDb(async () => {
        const memberships = await WorkspaceMember.find({
          userId: oid(userId),
        }).lean();
        const ids = memberships.map((m) => m.workspaceId);
        const workspaces = await Workspace.find({
          _id: { $in: ids },
          archivedAt: null,
        })
          .sort({ kind: 1, createdAt: 1 })
          .lean();
        const roleById = new Map(
          memberships.map((m) => [m.workspaceId.toString(), m.role as MemberRole]),
        );
        return Promise.all(
          workspaces.map(async (workspace) => {
            const role = roleById.get(workspace._id.toString()) ?? "member";
            let unreadCount = 0;
            if (workspace.kind === "personal") {
              const dmMemberships = await ConversationMember.find({ userId: oid(userId) }).lean();
              const dmIds = dmMemberships.map((m) => m.conversationId);
              const dms = await Conversation.find({
                _id: { $in: dmIds },
                kind: { $in: ["dm", "group_dm"] },
                archivedAt: null,
              }).lean();
              for (const dm of dms) {
                unreadCount += await countUnreadInConversation(userId, dm._id.toString());
              }
            } else {
              unreadCount = await countWorkspaceUnread(userId, workspace._id.toString());
            }
            return mapWorkspaceSummary(workspace, role, unreadCount);
          }),
        );
      });
    },

    async getWorkspace(id) {
      return withDb(async () => {
        const role = await requireMembership(userId, id);
        const workspace = await Workspace.findById(id).lean();
        if (!workspace || workspace.archivedAt) {
          throw new ApiError(404, "not_found", "Workspace not found");
        }
        return { ...mapWorkspace(workspace), role };
      });
    },

    async createWorkspace(input) {
      return withDb(async () => {
        const base = slugify(input.name);
        let slug = base;
        let n = 0;
        while (await Workspace.exists({ slug })) {
          n += 1;
          slug = `${base}-${n}`;
        }

        const workspace = await Workspace.create({
          kind: "team",
          name: input.name.trim(),
          slug,
          ownerUserId: oid(userId),
        });

        await WorkspaceMember.create({
          workspaceId: workspace._id,
          userId: oid(userId),
          role: "owner",
        });

        return mapWorkspace(workspace);
      });
    },

    async updateWorkspace(id, input) {
      return withDb(async () => {
        const role = await requireWorkspaceMember(userId, id);
        requirePermission(role, "channel.manage");
        const workspace = await Workspace.findById(id);
        if (!workspace || workspace.archivedAt || workspace.kind !== "team") {
          throw new ApiError(404, "not_found", "Workspace not found");
        }
        if (input.name?.trim()) workspace.name = input.name.trim();
        if (input.slug?.trim()) {
          const taken = await Workspace.exists({ slug: input.slug.trim(), _id: { $ne: workspace._id } });
          if (taken) throw new ApiError(409, "conflict", "Slug already taken");
          workspace.slug = input.slug.trim();
        }
        await workspace.save();
        return mapWorkspace(workspace);
      });
    },

    async listMembers(workspaceId) {
      return withDb(async () => {
        await requireWorkspaceMember(userId, workspaceId);
        const rows = await WorkspaceMember.find({ workspaceId: oid(workspaceId) }).lean();
        const users = await PulseUser.find({
          _id: { $in: rows.map((row) => row.userId) },
        }).lean();
        const userById = new Map(users.map((user) => [user._id.toString(), user]));
        return rows.flatMap((row) => {
          const user = userById.get(row.userId.toString());
          if (!user) return [];
          return [{ ...mapWorkspaceMember(row), user: mapUser(user) }];
        });
      });
    },

    async updateMemberRole(workspaceId, targetUserId, role) {
      return withDb(async () => {
        const actorRole = await requireWorkspaceMember(userId, workspaceId);
        requirePermission(actorRole, "members.manage");
        if (role === "owner") {
          throw new ApiError(400, "invalid_request", "Cannot assign owner role");
        }
        const target = await WorkspaceMember.findOne({
          workspaceId: oid(workspaceId),
          userId: oid(targetUserId),
        });
        if (!target) throw new ApiError(404, "not_found", "Member not found");
        if (target.role === "owner") {
          throw new ApiError(403, "forbidden", "Cannot change owner role");
        }
        target.role = role;
        await target.save();
      });
    },

    async removeMember(workspaceId, targetUserId) {
      return withDb(async () => {
        const actorRole = await requireWorkspaceMember(userId, workspaceId);
        requirePermission(actorRole, "members.manage");
        const target = await WorkspaceMember.findOne({
          workspaceId: oid(workspaceId),
          userId: oid(targetUserId),
        });
        if (!target) throw new ApiError(404, "not_found", "Member not found");
        if (target.role === "owner") {
          throw new ApiError(403, "forbidden", "Cannot remove workspace owner");
        }
        await target.deleteOne();
        await publishRealtime({
          channel: pulseChannel.workspace(workspaceId),
          event: "member.left",
          data: { userId: targetUserId },
        });
      });
    },

    async createInvite(workspaceId, input) {
      return withDb(async () => {
        const role = await requireWorkspaceMember(userId, workspaceId);
        requirePermission(role, "members.manage");
        const email = input.email.trim().toLowerCase();
        const existingUser = await PulseUser.findOne({ email }).lean();
        if (existingUser) {
          const already = await WorkspaceMember.findOne({
            workspaceId: oid(workspaceId),
            userId: existingUser._id,
          }).lean();
          if (already) {
            throw new ApiError(409, "conflict", "User is already a member");
          }
          await WorkspaceMember.create({
            workspaceId: oid(workspaceId),
            userId: existingUser._id,
            role: input.role,
          });
          await publishRealtime({
            channel: pulseChannel.workspace(workspaceId),
            event: "member.joined",
            data: { userId: existingUser._id.toString(), role: input.role },
          });
          const token = newInviteToken();
          const invite = await Invite.create({
            workspaceId: oid(workspaceId),
            email,
            role: input.role,
            tokenHash: hashInviteToken(token),
            invitedById: oid(userId),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            acceptedAt: new Date(),
          });
          return mapInvite(invite);
        }
        const token = newInviteToken();
        const invite = await Invite.create({
          workspaceId: oid(workspaceId),
          email,
          role: input.role,
          tokenHash: hashInviteToken(token),
          invitedById: oid(userId),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        return mapInvite(invite);
      });
    },

    async searchUsers(q) {
      return withDb(async () => {
        const query = q.trim();
        if (!query) return [];
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const users = await PulseUser.find({
          _id: { $ne: oid(userId) },
          $or: [
            { displayName: { $regex: escaped, $options: "i" } },
            { email: { $regex: escaped, $options: "i" } },
          ],
        })
          .limit(20)
          .lean();
        return users.map(mapUser);
      });
    },

    async listConversations(scope) {
      return withDb(async () => {
        if (scope.workspaceId) {
          await requireWorkspaceMember(userId, scope.workspaceId);
          const channelIds = await accessibleChannelIds(userId, scope.workspaceId);
          const conversations = await Conversation.find({
            _id: { $in: channelIds.map(oid) },
            archivedAt: null,
          })
            .sort({ lastMessageAt: -1, updatedAt: -1 })
            .lean();
          return Promise.all(conversations.map((conversation) => toSummary(conversation, userId)));
        }

        const memberships = await ConversationMember.find({
          userId: oid(userId),
        }).lean();
        const ids = memberships.map((m) => m.conversationId);
        const filter: Record<string, unknown> = {
          _id: { $in: ids },
          archivedAt: null,
          kind: { $in: scope.kind ?? ["dm", "group_dm"] },
        };

        const conversations = await Conversation.find(filter)
          .sort({ lastMessageAt: -1, updatedAt: -1 })
          .lean();
        return Promise.all(conversations.map((conversation) => toSummary(conversation, userId)));
      });
    },

    async getConversation(id) {
      return withDb(async () => {
        const { conversation } = await assertConversationAccess(userId, id);
        return toSummary(conversation, userId);
      });
    },

    async createDm(targetUserId) {
      return withDb(async () => {
        if (targetUserId === userId) {
          throw new ApiError(400, "invalid_request", "Cannot DM yourself");
        }
        if (!Types.ObjectId.isValid(targetUserId)) {
          throw new ApiError(400, "invalid_request", "Invalid user");
        }
        const other = await PulseUser.findById(targetUserId).lean();
        if (!other) throw new ApiError(404, "not_found", "User not found");

        const dmKey = dmKeyFor(userId, targetUserId);
        const existing = await Conversation.findOne({ dmKey, kind: "dm" });
        if (existing) return toSummary(existing, userId);

        const conversation = await Conversation.create({
          kind: "dm",
          workspaceId: null,
          name: null,
          visibility: null,
          dmKey,
          createdById: oid(userId),
        });
        await ConversationMember.insertMany([
          { conversationId: conversation._id, userId: oid(userId) },
          { conversationId: conversation._id, userId: oid(targetUserId) },
        ]);
        const summary = await toSummary(conversation, userId);
        await publishRealtime({
          channel: pulseChannel.inbox(targetUserId),
          event: "inbox.dm.created",
          data: { conversation: summary },
        });
        return summary;
      });
    },

    async createGroupDm(input) {
      return withDb(async () => {
        const unique = [...new Set(input.userIds.filter((id) => id !== userId))];
        if (unique.length < 2) {
          throw new ApiError(400, "invalid_request", "Group DMs need at least two other people");
        }
        for (const id of unique) {
          if (!Types.ObjectId.isValid(id)) {
            throw new ApiError(400, "invalid_request", "Invalid user");
          }
        }
        const others = await PulseUser.find({ _id: { $in: unique.map(oid) } }).lean();
        if (others.length !== unique.length) {
          throw new ApiError(404, "not_found", "User not found");
        }
        const conversation = await Conversation.create({
          kind: "group_dm",
          workspaceId: null,
          name: input.name?.trim() || null,
          visibility: null,
          dmKey: null,
          createdById: oid(userId),
        });
        await ConversationMember.insertMany(
          [userId, ...unique].map((id) => ({
            conversationId: conversation._id,
            userId: oid(id),
          })),
        );
        const summary = await toSummary(conversation, userId);
        await Promise.all(
          unique.map((id) =>
            publishRealtime({
              channel: pulseChannel.inbox(id),
              event: "inbox.dm.created",
              data: { conversation: summary },
            }),
          ),
        );
        return summary;
      });
    },

    async createChannel(input) {
      return withDb(async () => {
        const role = await requireWorkspaceMember(userId, input.workspaceId);
        requirePermission(role, "channel.create");
        const base = slugifyChannel(input.name);
        let slug = base;
        let n = 0;
        while (
          await Conversation.exists({
            workspaceId: oid(input.workspaceId),
            slug,
          })
        ) {
          n += 1;
          slug = `${base}-${n}`;
        }
        const conversation = await Conversation.create({
          kind: "channel",
          workspaceId: oid(input.workspaceId),
          name: input.name.trim(),
          slug,
          topic: input.topic?.trim() || null,
          visibility: input.visibility,
          dmKey: null,
          createdById: oid(userId),
        });
        await ConversationMember.create({
          conversationId: conversation._id,
          userId: oid(userId),
        });
        if (input.visibility === "private") {
          // creator already added; private channels stay invite-only
        }
        const channel = asChannel(conversation);
        await publishRealtime({
          channel: pulseChannel.workspace(input.workspaceId),
          event: "channel.created",
          data: { channel },
        });
        return channel;
      });
    },

    async updateChannel(id, input) {
      return withDb(async () => {
        const conversation = await Conversation.findById(id);
        if (!conversation || conversation.archivedAt || conversation.kind !== "channel") {
          throw new ApiError(404, "not_found", "Channel not found");
        }
        const workspaceId = conversation.workspaceId!.toString();
        const role = await requireWorkspaceMember(userId, workspaceId);
        requirePermission(role, "channel.manage");
        if (input.name?.trim()) conversation.name = input.name.trim();
        if (input.topic !== undefined) conversation.topic = input.topic?.trim() || null;
        if (input.visibility) conversation.visibility = input.visibility;
        await conversation.save();
        const channel = asChannel(conversation);
        await publishRealtime({
          channel: pulseChannel.workspace(workspaceId),
          event: "channel.updated",
          data: { channel },
        });
        return channel;
      });
    },

    async archiveChannel(id) {
      return withDb(async () => {
        const conversation = await Conversation.findById(id);
        if (!conversation || conversation.archivedAt || conversation.kind !== "channel") {
          throw new ApiError(404, "not_found", "Channel not found");
        }
        const workspaceId = conversation.workspaceId!.toString();
        const role = await requireWorkspaceMember(userId, workspaceId);
        requirePermission(role, "channel.manage");
        conversation.archivedAt = new Date();
        await conversation.save();
        await publishRealtime({
          channel: pulseChannel.workspace(workspaceId),
          event: "channel.archived",
          data: { channelId: id },
        });
      });
    },

    async addChannelMembers(conversationId, userIds) {
      return withDb(async () => {
        const conversation = await Conversation.findById(conversationId).lean();
        if (!conversation || conversation.archivedAt || conversation.kind !== "channel") {
          throw new ApiError(404, "not_found", "Channel not found");
        }
        if (conversation.visibility !== "private") {
          throw new ApiError(400, "invalid_request", "Only private channels have explicit members");
        }
        const workspaceId = conversation.workspaceId!.toString();
        const role = await requireWorkspaceMember(userId, workspaceId);
        requirePermission(role, "channel.manage");
        const unique = [...new Set(userIds)];
        const wsMembers = await WorkspaceMember.find({
          workspaceId: oid(workspaceId),
          userId: { $in: unique.map(oid) },
        }).lean();
        if (wsMembers.length !== unique.length) {
          throw new ApiError(400, "invalid_request", "All users must be workspace members");
        }
        await ConversationMember.insertMany(
          unique.map((id) => ({
            conversationId: oid(conversationId),
            userId: oid(id),
          })),
          { ordered: false },
        ).catch(() => undefined);
      });
    },

    async removeChannelMember(conversationId, targetUserId) {
      return withDb(async () => {
        const conversation = await Conversation.findById(conversationId).lean();
        if (!conversation || conversation.archivedAt || conversation.kind !== "channel") {
          throw new ApiError(404, "not_found", "Channel not found");
        }
        if (conversation.visibility !== "private") {
          throw new ApiError(400, "invalid_request", "Only private channels have explicit members");
        }
        const workspaceId = conversation.workspaceId!.toString();
        const role = await requireWorkspaceMember(userId, workspaceId);
        requirePermission(role, "channel.manage");
        await ConversationMember.deleteOne({
          conversationId: oid(conversationId),
          userId: oid(targetUserId),
        });
      });
    },

    async listMessages(conversationId, query) {
      return withDb(async () => {
        await assertConversationAccess(userId, conversationId);
        const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
        const threadParentId = query.threadParentId
          ? oid(query.threadParentId)
          : null;
        const filter: Record<string, unknown> = {
          conversationId: oid(conversationId),
          threadParentId,
        };

        if (query.anchorMessageId) {
          if (!Types.ObjectId.isValid(query.anchorMessageId)) {
            throw new ApiError(400, "invalid_request", "Invalid anchor message");
          }
          const anchor = await MessageModel.findById(query.anchorMessageId).lean();
          if (!anchor || anchor.conversationId.toString() !== conversationId) {
            throw new ApiError(404, "not_found", "Message not found");
          }
          const window = Math.floor(limit / 2);
          const [older, newer] = await Promise.all([
            MessageModel.find({
              conversationId: oid(conversationId),
              threadParentId,
              createdAt: { $lte: anchor.createdAt },
            })
              .sort({ createdAt: -1 })
              .limit(window + 1)
              .lean(),
            MessageModel.find({
              conversationId: oid(conversationId),
              threadParentId,
              createdAt: { $gt: anchor.createdAt },
            })
              .sort({ createdAt: 1 })
              .limit(window)
              .lean(),
          ]);
          const combined = [...older.reverse(), ...newer];
          const mapped = await hydrateReactions(combined.map(mapMessage));
          const hasOlder = older.length > window;
          return {
            messages: mapped,
            nextCursor: hasOlder && mapped[0] ? mapped[0].id : null,
            prevCursor: newer.length >= window ? mapped.at(-1)?.id ?? null : null,
          };
        }

        if (query.after) {
          if (!Types.ObjectId.isValid(query.after)) {
            throw new ApiError(400, "invalid_request", "Invalid cursor");
          }
          const afterDoc = await MessageModel.findById(query.after).lean();
          if (afterDoc) {
            filter.createdAt = { $gt: afterDoc.createdAt };
          }
          const newer = await MessageModel.find(filter)
            .sort({ createdAt: 1 })
            .limit(limit)
            .lean();
          const mapped = await hydrateReactions(newer.map(mapMessage));
          return { messages: mapped, nextCursor: null, prevCursor: null };
        }

        if (query.before) {
          if (!Types.ObjectId.isValid(query.before)) {
            throw new ApiError(400, "invalid_request", "Invalid cursor");
          }
          const beforeDoc = await MessageModel.findById(query.before).lean();
          if (beforeDoc) {
            filter.createdAt = { $lt: beforeDoc.createdAt };
          }
        }

        const batch = await MessageModel.find(filter)
          .sort({ createdAt: -1 })
          .limit(limit + 1)
          .lean();
        const hasMore = batch.length > limit;
        const slice = hasMore ? batch.slice(0, limit) : batch;
        slice.reverse();
        const mapped = await hydrateReactions(slice.map(mapMessage));
        return {
          messages: mapped,
          nextCursor: hasMore && mapped[0] ? mapped[0].id : null,
          prevCursor: null,
        };
      });
    },

    async sendMessage(input) {
      return withDb(async () => {
        const { conversation } = await assertConversationAccess(userId, input.conversationId);
        await ensureConversationMember(userId, input.conversationId);
        const content = sanitizeMessageContent(input.content ?? "");
        const rawMentions = extractMentionedUserIds(content);
        const attachmentIds = input.attachmentIds ?? [];
        if (!content && attachmentIds.length === 0) {
          throw new ApiError(400, "invalid_request", "Message is empty");
        }

        const existing = await MessageModel.findOne({
          senderId: oid(userId),
          clientNonce: input.clientNonce,
        }).lean();
        if (existing) {
          const [hydrated] = await hydrateReactions([mapMessage(existing)]);
          return hydrated;
        }

        let mentionedUserIds = rawMentions;
        if (conversation.workspaceId && mentionedUserIds.length > 0) {
          const wsMembers = await WorkspaceMember.find({
            workspaceId: conversation.workspaceId,
            userId: { $in: mentionedUserIds.map(oid) },
          }).lean();
          mentionedUserIds = wsMembers.map((m) => m.userId.toString());
        }

        let attachments: Attachment[] = [];
        if (attachmentIds.length) {
          const uploads = await Upload.find({
            _id: { $in: attachmentIds.map(oid) },
            userId: oid(userId),
          }).lean();
          if (uploads.length !== attachmentIds.length) {
            throw new ApiError(400, "invalid_request", "Invalid attachments");
          }
          attachments = uploads.map((upload) => ({
            id: upload._id.toString(),
            kind: upload.kind,
            filename: upload.filename,
            mime: upload.mime,
            sizeBytes: upload.sizeBytes,
            url: upload.url,
            width: upload.width ?? null,
            height: upload.height ?? null,
          }));
        }

        const threadParentId = input.threadParentId ? oid(input.threadParentId) : null;
        if (threadParentId) {
          const parent = await MessageModel.findById(threadParentId).lean();
          if (!parent || parent.conversationId.toString() !== input.conversationId) {
            throw new ApiError(400, "invalid_request", "Invalid thread parent");
          }
        }

        const created = await MessageModel.create({
          conversationId: oid(input.conversationId),
          senderId: oid(userId),
          content,
          mentionedUserIds: mentionedUserIds.map(oid),
          attachments,
          threadParentId,
          clientNonce: input.clientNonce,
        });

        await Conversation.findByIdAndUpdate(conversation._id, {
          lastMessageAt: created.createdAt,
          lastMessagePreview: previewOf(content),
        });

        if (threadParentId) {
          const parent = await MessageModel.findByIdAndUpdate(
            threadParentId,
            { $inc: { replyCount: 1 }, lastReplyAt: created.createdAt },
            { new: true },
          ).lean();
          if (parent) {
            await publishRealtime({
              channel: pulseChannel.conv(input.conversationId),
              event: "thread.updated",
              data: {
                parentId: threadParentId.toString(),
                replyCount: parent.replyCount ?? 1,
                lastReplyAt: parent.lastReplyAt?.toISOString() ?? created.createdAt.toISOString(),
              },
            });
          }
        }

        const [message] = await hydrateReactions([mapMessage(created)]);
        const memberIds = (
          await ConversationMember.find({ conversationId: conversation._id })
            .select("userId")
            .lean()
        ).map((m) => m.userId.toString());

        if (conversation.kind === "channel" && conversation.visibility === "public") {
          const wsMembers = await WorkspaceMember.find({
            workspaceId: conversation.workspaceId,
          })
            .select("userId")
            .lean();
          for (const row of wsMembers) {
            const id = row.userId.toString();
            if (!memberIds.includes(id)) memberIds.push(id);
          }
        }

        const sender = await PulseUser.findById(userId).lean();
        await fanoutMessage({
          conversationId: input.conversationId,
          message,
          memberIds: [...new Set(memberIds)],
          senderId: userId,
          workspaceId: conversation.workspaceId?.toString() ?? null,
          threadParentId: threadParentId?.toString() ?? null,
          mentionedUserIds,
          conversationKind: conversation.kind,
          conversationName: conversation.name ?? null,
          conversationSlug: conversation.slug ?? null,
          senderName: sender?.displayName ?? "Someone",
        });
        return message;
      });
    },

    async editMessage(messageId, content) {
      return withDb(async () => {
        const message = await MessageModel.findById(messageId);
        if (!message || message.deletedAt) {
          throw new ApiError(404, "not_found", "Message not found");
        }
        await assertConversationAccess(userId, message.conversationId.toString());
        if (message.senderId.toString() !== userId) {
          throw new ApiError(403, "forbidden", "You can only edit your own messages");
        }
        if ((message.kind ?? "user") === "call_log") {
          throw new ApiError(400, "invalid_request", "Call log entries cannot be edited");
        }
        message.content = sanitizeMessageContent(content);
        message.editedAt = new Date();
        await message.save();
        const [mapped] = await hydrateReactions([mapMessage(message)]);
        await publishRealtime({
          channel: pulseChannel.conv(message.conversationId.toString()),
          event: "message.edited",
          data: {
            messageId: mapped.id,
            content: mapped.content,
            editedAt: mapped.editedAt,
            mentionedUserIds: mapped.mentionedUserIds,
          },
        });
        return mapped;
      });
    },

    async deleteMessage(messageId) {
      return withDb(async () => {
        const message = await MessageModel.findById(messageId);
        if (!message) {
          throw new ApiError(404, "not_found", "Message not found");
        }
        const { conversation } = await assertConversationAccess(
          userId,
          message.conversationId.toString(),
        );
        const isAuthor = message.senderId.toString() === userId;
        let canModerate = false;
        if (!isAuthor && conversation.kind === "channel" && conversation.workspaceId) {
          const role = await requireWorkspaceMember(
            userId,
            conversation.workspaceId.toString(),
          );
          canModerate = can(role, "message.moderate");
        }
        if (!isAuthor && !canModerate) {
          throw new ApiError(403, "forbidden", "You can only delete your own messages");
        }
        message.deletedAt = new Date();
        await message.save();
        const mapped = mapMessage(message);
        await publishRealtime({
          channel: pulseChannel.conv(message.conversationId.toString()),
          event: "message.deleted",
          data: { messageId: mapped.id, deletedAt: mapped.deletedAt },
        });
        return mapped;
      });
    },

    async toggleReaction(messageId, emoji) {
      return withDb(async () => {
        const message = await MessageModel.findById(messageId).lean();
        if (!message || message.deletedAt) {
          throw new ApiError(404, "not_found", "Message not found");
        }
        await assertConversationAccess(userId, message.conversationId.toString());
        const existing = await Reaction.findOne({
          messageId: message._id,
          userId: oid(userId),
          emoji,
        });
        if (existing) {
          await existing.deleteOne();
          await publishRealtime({
            channel: pulseChannel.conv(message.conversationId.toString()),
            event: "reaction.removed",
            data: { messageId, userId, emoji },
          });
          return { added: false, reaction: null };
        }
        const created = await Reaction.create({
          messageId: message._id,
          conversationId: message.conversationId,
          userId: oid(userId),
          emoji,
        });
        const reaction = {
          id: created._id.toString(),
          messageId,
          conversationId: message.conversationId.toString(),
          userId,
          emoji,
          createdAt: (created.createdAt ?? new Date()).toISOString(),
        };
        await publishRealtime({
          channel: pulseChannel.conv(message.conversationId.toString()),
          event: "reaction.added",
          data: { reaction },
        });
        return { added: true, reaction };
      });
    },

    async markRead(conversationId, lastReadMessageId) {
      return withDb(async () => {
        await assertConversationAccess(userId, conversationId);
        await ensureConversationMember(userId, conversationId);
        if (!Types.ObjectId.isValid(lastReadMessageId)) {
          throw new ApiError(400, "invalid_request", "Invalid message");
        }
        const now = new Date();
        await ConversationMember.findOneAndUpdate(
          { conversationId: oid(conversationId), userId: oid(userId) },
          {
            lastReadMessageId: oid(lastReadMessageId),
            lastReadAt: now,
          },
        );
        const receipt = {
          conversationId,
          userId,
          lastReadMessageId,
          timestamp: now.toISOString(),
        };
        await publishRealtime({
          channel: pulseChannel.conv(conversationId),
          event: "read.receipt",
          data: { receipt },
        });
        return receipt;
      });
    },

    async searchMessages(input) {
      return withDb(async () => {
        const q = input.q.trim();
        if (!q) return { hits: [], nextCursor: null };

        let allowedIds: string[] = [];
        if (input.conversationId) {
          await assertConversationAccess(userId, input.conversationId);
          allowedIds = [input.conversationId];
        } else if (input.workspaceId) {
          allowedIds = await accessibleChannelIds(userId, input.workspaceId);
        } else {
          const memberships = await ConversationMember.find({ userId: oid(userId) }).lean();
          const convs = await Conversation.find({
            _id: { $in: memberships.map((m) => m.conversationId) },
            archivedAt: null,
          }).lean();
          allowedIds = convs
            .filter((conv) =>
              canViewConversation({
                kind: conv.kind,
                visibility: conv.visibility ?? null,
                isWorkspaceMember: true,
                isConversationMember: true,
              }),
            )
            .map((conv) => conv._id.toString());
        }

        if (allowedIds.length === 0) return { hits: [], nextCursor: null };

        const limit = 25;
        const atlasIndex = process.env.MONGODB_ATLAS_SEARCH_INDEX;
        let rows: Array<Parameters<typeof mapMessage>[0] & { score?: number }>;

        if (atlasIndex) {
          const pipeline: PipelineStage[] = [
            {
              $search: {
                index: atlasIndex,
                text: { query: q, path: "content" },
              },
            },
            {
              $match: {
                conversationId: { $in: allowedIds.map(oid) },
                deletedAt: null,
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: limit + 1 },
          ];
          if (input.cursor && Types.ObjectId.isValid(input.cursor)) {
            const cursorDoc = await MessageModel.findById(input.cursor).lean();
            if (cursorDoc) {
              pipeline.splice(2, 0, { $match: { createdAt: { $lt: cursorDoc.createdAt } } });
            }
          }
          rows = await MessageModel.aggregate(pipeline);
        } else {
          const filter: Record<string, unknown> = {
            conversationId: { $in: allowedIds.map(oid) },
            deletedAt: null,
            $text: { $search: q },
          };
          if (input.cursor && Types.ObjectId.isValid(input.cursor)) {
            const cursorDoc = await MessageModel.findById(input.cursor).lean();
            if (cursorDoc) {
              filter.createdAt = { $lt: cursorDoc.createdAt };
            }
          }

          rows = await MessageModel.find(filter, { score: { $meta: "textScore" } })
            .sort({ score: { $meta: "textScore" }, createdAt: -1 })
            .limit(limit + 1)
            .lean();
        }
        const hasMore = rows.length > limit;
        const slice = hasMore ? rows.slice(0, limit) : rows;
        const conversations = await Conversation.find({
          _id: { $in: [...new Set(slice.map((row) => row.conversationId.toString()))].map(oid) },
        }).lean();
        const convById = new Map(conversations.map((conv) => [conv._id.toString(), conv]));
        const hits = slice.map((row) => ({
          ...mapMessage(row),
          conversation: mapConversation(convById.get(row.conversationId.toString())!),
        }));
        return {
          hits,
          nextCursor: hasMore && slice.at(-1) ? slice.at(-1)!._id.toString() : null,
        };
      });
    },

    async listNotifications(cursor) {
      return withDb(async () => {
        const limit = 30;
        const filter: Record<string, unknown> = { userId: oid(userId) };
        if (cursor && Types.ObjectId.isValid(cursor)) {
          const cursorDoc = await NotificationModel.findById(cursor).lean();
          if (cursorDoc) filter.createdAt = { $lt: cursorDoc.createdAt };
        }
        const rows = await NotificationModel.find(filter)
          .sort({ createdAt: -1 })
          .limit(limit + 1)
          .lean();
        const hasMore = rows.length > limit;
        const slice = hasMore ? rows.slice(0, limit) : rows;
        return {
          items: slice.map(mapNotification),
          nextCursor: hasMore && slice.at(-1) ? slice.at(-1)!._id.toString() : null,
        };
      });
    },

    async markNotificationsRead(ids) {
      return withDb(async () => {
        await NotificationModel.updateMany(
          { _id: { $in: ids.map(oid) }, userId: oid(userId) },
          { readAt: new Date() },
        );
      });
    },

    async updatePreferences(input) {
      return withDb(async () => {
        const user = await PulseUser.findByIdAndUpdate(
          userId,
          {
            ...(input.defaultNotificationPref
              ? { defaultNotificationPref: input.defaultNotificationPref }
              : {}),
          },
          { new: true },
        ).lean();
        if (!user) throw new ApiError(401, "unauthorized", "User not found");
        return mapUser(user);
      });
    },

    async updateConversationNotifications(conversationId, notifications) {
      return withDb(async () => {
        await assertConversationAccess(userId, conversationId);
        await ConversationMember.findOneAndUpdate(
          { conversationId: oid(conversationId), userId: oid(userId) },
          { notifications },
        );
      });
    },

    async subscribePush(input) {
      return withDb(async () => {
        await PushSubscription.findOneAndUpdate(
          { endpoint: input.endpoint },
          {
            userId: oid(userId),
            endpoint: input.endpoint,
            p256dh: input.p256dh,
            auth: input.auth,
            userAgent: input.userAgent ?? null,
          },
          { upsert: true, new: true },
        );
      });
    },

    async unsubscribePush(endpoint) {
      return withDb(async () => {
        await PushSubscription.deleteOne({ endpoint, userId: oid(userId) });
      });
    },

    async createUpload(file) {
      return withDb(async () => {
        const maxBytes = file.mime.startsWith("image/") ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
        if (file.sizeBytes > maxBytes) {
          throw new ApiError(400, "invalid_request", "File is too large");
        }
        const kind = file.mime.startsWith("image/") ? "image" : "file";
        const id = new Types.ObjectId();
        const dir = path.join(process.cwd(), ".uploads");
        await mkdir(dir, { recursive: true });
        const storagePath = path.join(dir, id.toString());
        await writeFile(storagePath, file.body);
        const url = `/api/uploads/${id.toString()}/file`;
        await Upload.create({
          _id: id,
          userId: oid(userId),
          kind,
          filename: file.filename,
          mime: file.mime,
          sizeBytes: file.sizeBytes,
          storagePath,
          url,
        });
        return {
          id: id.toString(),
          kind,
          filename: file.filename,
          mime: file.mime,
          sizeBytes: file.sizeBytes,
          url,
          width: null,
          height: null,
        };
      });
    },

    async createCall(input) {
      return withDb(() => createCallForUser(userId, input));
    },
    async getCall(callId) {
      return withDb(() => getCallForUser(userId, callId));
    },
    async getActiveCall(conversationId) {
      return withDb(() => getActiveCallForUser(userId, conversationId));
    },
    async acceptCall(callId) {
      return withDb(() => acceptCallForUser(userId, callId));
    },
    async declineCall(callId) {
      return withDb(() => declineCallForUser(userId, callId));
    },
    async endCall(callId) {
      return withDb(() => endCallForUser(userId, callId));
    },
    async markCallConnected(callId) {
      return withDb(() => markCallConnectedForUser(userId, callId));
    },
    async joinCall(callId) {
      return withDb(() => joinCallForUser(userId, callId));
    },
    async leaveCall(callId) {
      return withDb(() => leaveCallForUser(userId, callId));
    },
    async upgradeCallToSfu(callId) {
      return withDb(() => upgradeCallToSfuForUser(userId, callId));
    },
    async setCallPresenter(callId, targetUserId) {
      return withDb(() => setPresenterForUser(userId, callId, targetUserId));
    },
    async muteCallParticipant(callId, targetUserId) {
      return withDb(() => muteParticipantForUser(userId, callId, targetUserId));
    },
    async sfuJoin(callId) {
      return withDb(() => sfuJoinForUser(userId, callId));
    },
    async sfuCreateTransport(callId, direction) {
      return withDb(() => sfuCreateTransportForUser(userId, callId, direction));
    },
    async sfuConnectTransport(callId, transportId, dtlsParameters) {
      return withDb(() => sfuConnectTransportForUser(userId, callId, transportId, dtlsParameters));
    },
    async sfuProduce(callId, input) {
      return withDb(() => sfuProduceForUser(userId, callId, input));
    },
    async sfuConsume(callId, input) {
      return withDb(() => sfuConsumeForUser(userId, callId, input));
    },
    async sfuResumeConsumer(callId, consumerId) {
      return withDb(() => sfuResumeConsumerForUser(userId, callId, consumerId));
    },
    async sfuSetConsumerLayers(callId, consumerId, layers) {
      return withDb(() => sfuSetConsumerLayersForUser(userId, callId, consumerId, layers));
    },
  };
}
