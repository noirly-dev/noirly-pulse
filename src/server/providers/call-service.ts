import type { CallEndReason, CallLogKind, CallType, MemberRole } from "@/src/core/models/enums";
import { LIVE_CALL_STATUSES } from "@/src/core/models/enums";
import type { CallPublic, CallParticipantPublic, Message } from "@/src/core/models/types";
import { DEFAULT_RING_TIMEOUT_MS } from "@/src/core/calls/constants";
import { callLogContent } from "@/src/core/calls/copy";
import { conversationHref } from "@/src/core/calls/href";
import { can } from "@/src/core/permissions/can";
import { pulseChannel } from "@/src/core/realtime/channels";
import {
  isConversationMuted,
  shouldDeliverNotification,
} from "@/src/core/notifications/should-notify";
import { ApiError } from "@/src/server/api/http";
import {
  mapCall,
  mapCallParticipant,
  mapMessage,
  mapUser,
} from "@/src/server/mappers";
import {
  Call,
  CallParticipant,
  Conversation,
  ConversationMember,
  Message as MessageModel,
  Notification as NotificationModel,
  PulseUser,
  WorkspaceMember,
} from "@/src/server/models";
import { publishRealtime } from "@/src/server/realtime/publish";
import { sendPushToUser } from "@/src/server/push/send";
import {
  conversationAccessContext,
  oid,
} from "@/src/server/providers/workspace-helpers";
import type { CallDocument } from "@/src/server/models/Call";
import type { ConversationDocument } from "@/src/server/models/Conversation";
import {
  connectSfuTransport,
  createSfuTransport,
  deleteSfuRoom,
  ensureSfuRoom,
  getSfuRoom,
  pauseSfuProducer,
  resumeSfuConsumer,
  setSfuConsumerLayers,
  sfuConsume,
  sfuProduce,
  type SfuConsumeResult,
  type SfuDtlsParameters,
  type SfuMediaKind,
  type SfuRoomSnapshot,
  type SfuRtpCapabilities,
  type SfuRtpParameters,
  type SfuTrackSource,
  type SfuTransportDirection,
  type SfuTransportInfo,
} from "@/src/server/sfu/client";
import type { HydratedDocument, Types } from "mongoose";

type CallDoc = HydratedDocument<CallDocument>;

function isDuplicateKey(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

function previewOf(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 140);
}

async function memberIdsForConversation(conversation: {
  _id: Types.ObjectId;
  kind: string;
  visibility?: string | null;
  workspaceId?: Types.ObjectId | null;
}): Promise<string[]> {
  const rows = await ConversationMember.find({ conversationId: conversation._id })
    .select("userId")
    .lean();
  const ids = rows.map((row) => row.userId.toString());
  if (conversation.kind === "channel" && conversation.visibility === "public" && conversation.workspaceId) {
    const wsMembers = await WorkspaceMember.find({ workspaceId: conversation.workspaceId })
      .select("userId")
      .lean();
    for (const row of wsMembers) {
      const id = row.userId.toString();
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return [...new Set(ids)];
}

async function memberNotificationPref(userId: string, conversationId: string) {
  const [member, user] = await Promise.all([
    ConversationMember.findOne({
      conversationId: oid(conversationId),
      userId: oid(userId),
    }).lean(),
    PulseUser.findById(userId).lean(),
  ]);
  return {
    pref: (member?.notifications ?? user?.defaultNotificationPref ?? "all") as
      | "all"
      | "mentions"
      | "none",
    mutedUntil: member?.mutedUntil ? member.mutedUntil.toISOString() : null,
  };
}

export async function hydrateCall(call: CallDoc | { _id: Types.ObjectId }): Promise<CallPublic> {
  const doc = "_id" in call && "status" in call ? call : await Call.findById(call._id).lean();
  if (!doc) {
    throw new ApiError(404, "not_found", "Call not found");
  }
  const participants = await CallParticipant.find({ callId: doc._id }).lean();
  const users = await PulseUser.find({
    _id: { $in: participants.map((row) => row.userId) },
  }).lean();
  const userById = new Map(users.map((user) => [user._id.toString(), user]));
  const mapped: CallParticipantPublic[] = participants.map((row) => {
    const user = userById.get(row.userId.toString());
    return {
      ...mapCallParticipant(row),
      displayName: user ? mapUser(user).displayName : "Unknown",
      avatarUrl: user ? mapUser(user).avatarUrl : null,
    };
  });
  return { ...mapCall(doc), participants: mapped };
}

async function findLiveCall(conversationId: string) {
  return Call.findOne({
    conversationId: oid(conversationId),
    status: { $in: [...LIVE_CALL_STATUSES] },
  });
}

async function userIsBusy(userId: string, exceptCallId?: string): Promise<boolean> {
  const rows = await CallParticipant.find({
    userId: oid(userId),
    leftAt: null,
  }).lean();
  if (rows.length === 0) return false;
  const callIds = rows
    .map((row) => row.callId.toString())
    .filter((id) => id !== exceptCallId);
  if (callIds.length === 0) return false;
  const live = await Call.findOne({
    _id: { $in: callIds.map(oid) },
    status: { $in: [...LIVE_CALL_STATUSES] },
  }).lean();
  return Boolean(live);
}

async function writeCallLog(opts: {
  call: CallDoc;
  logKind: CallLogKind;
  durationSeconds: number | null;
}): Promise<Message> {
  const content = callLogContent(opts.logKind, opts.call.type as CallType);
  const clientNonce = `call:${opts.call._id.toString()}:${opts.logKind}`;
  const existing = await MessageModel.findOne({
    senderId: opts.call.initiatedBy,
    clientNonce,
  }).lean();
  if (existing) return mapMessage(existing);

  const created = await MessageModel.create({
    conversationId: opts.call.conversationId,
    senderId: opts.call.initiatedBy,
    kind: "call_log",
    content,
    callLog: {
      callId: opts.call._id,
      logKind: opts.logKind,
      type: opts.call.type,
      durationSeconds: opts.durationSeconds,
      initiatedBy: opts.call.initiatedBy,
      mediaPath: opts.call.mediaPath,
    },
    mentionedUserIds: [],
    attachments: [],
    threadParentId: null,
    clientNonce,
  });
  await Conversation.findByIdAndUpdate(opts.call.conversationId, {
    lastMessageAt: created.createdAt,
    lastMessagePreview: previewOf(content),
  });
  const message = mapMessage(created);
  await publishRealtime({
    channel: pulseChannel.conv(opts.call.conversationId.toString()),
    event: "message.sent",
    data: { message },
  });
  return message;
}

async function publishCallConv(call: CallDoc, event: string, extra: Record<string, unknown> = {}) {
  const publicCall = await hydrateCall(call);
  await publishRealtime({
    channel: pulseChannel.conv(call.conversationId.toString()),
    event,
    data: { call: publicCall, ...extra },
  });
  return publicCall;
}

async function notifyIncoming(opts: {
  targetUserId: string;
  call: CallDoc;
  conversationKind: string;
  initiatedByName: string;
  ring: boolean;
  notifyIfPrefAll?: boolean;
}) {
  const conversationId = opts.call.conversationId.toString();
  const workspaceId = opts.call.workspaceId?.toString() ?? null;
  const { pref, mutedUntil } = await memberNotificationPref(opts.targetUserId, conversationId);
  if (isConversationMuted(mutedUntil)) return;

  const href = conversationHref({
    conversationId,
    workspaceId,
    conversationKind: opts.conversationKind as "dm" | "group_dm" | "channel",
    callId: opts.call._id.toString(),
  });
  const media = opts.call.type === "video" ? "video call" : "voice call";
  const inboxData = {
    callId: opts.call._id.toString(),
    conversationId,
    conversationKind: opts.conversationKind,
    workspaceId,
    initiatedBy: opts.call.initiatedBy.toString(),
    initiatedByName: opts.initiatedByName,
    type: opts.call.type,
    ringTimeoutMs: opts.call.ringTimeoutMs ?? DEFAULT_RING_TIMEOUT_MS,
  };

  if (opts.ring) {
    await publishRealtime({
      channel: pulseChannel.inbox(opts.targetUserId),
      event: "inbox.call.invite",
      data: inboxData,
    });
  }

  const allowNotify = opts.notifyIfPrefAll
    ? pref === "all"
    : shouldDeliverNotification(pref, "incoming_call");
  if (!allowNotify) return;

  await NotificationModel.create({
    userId: oid(opts.targetUserId),
    kind: "incoming_call",
    workspaceId: workspaceId ? oid(workspaceId) : null,
    conversationId: oid(conversationId),
    messageId: null,
    actorId: opts.call.initiatedBy,
  });
  await sendPushToUser(opts.targetUserId, {
    title: opts.initiatedByName,
    body: `Incoming ${media}`,
    url: href,
  });
}

async function notifyMissed(opts: {
  targetUserId: string;
  call: CallDoc;
  conversationKind: string;
  message: Message;
  initiatedByName: string;
}) {
  const conversationId = opts.call.conversationId.toString();
  const workspaceId = opts.call.workspaceId?.toString() ?? null;
  const { pref, mutedUntil } = await memberNotificationPref(opts.targetUserId, conversationId);
  if (isConversationMuted(mutedUntil) || !shouldDeliverNotification(pref, "missed_call")) {
    return;
  }
  await NotificationModel.create({
    userId: oid(opts.targetUserId),
    kind: "missed_call",
    workspaceId: workspaceId ? oid(workspaceId) : null,
    conversationId: oid(conversationId),
    messageId: oid(opts.message.id),
    actorId: opts.call.initiatedBy,
  });
  const href = conversationHref({
    conversationId,
    workspaceId,
    conversationKind: opts.conversationKind as "dm" | "group_dm" | "channel",
  });
  await sendPushToUser(opts.targetUserId, {
    title: "Missed call",
    body: `${opts.initiatedByName} — ${callLogContent("missed", opts.call.type as CallType)}`,
    url: href,
  });
}

function logKindForEnd(statusBefore: string, reason: CallEndReason): CallLogKind {
  if (reason === "declined") return "declined";
  if (reason === "timeout") return "missed";
  if (statusBefore === "ringing" && reason === "hangup") return "cancelled";
  return "ended";
}

async function finalizeCall(
  call: CallDoc,
  reason: CallEndReason,
): Promise<CallPublic> {
  if (!LIVE_CALL_STATUSES.includes(call.status as (typeof LIVE_CALL_STATUSES)[number])) {
    return hydrateCall(call);
  }
  const statusBefore = call.status;
  const now = new Date();
  const durationSeconds =
    call.startedAt != null
      ? Math.max(0, Math.round((now.getTime() - call.startedAt.getTime()) / 1000))
      : null;
  const logKind = logKindForEnd(statusBefore, reason);
  call.status = reason === "timeout" ? "missed" : "ended";
  call.endedAt = now;
  call.endReason = reason;
  await call.save();
  await CallParticipant.updateMany(
    { callId: call._id, leftAt: null },
    { $set: { leftAt: now } },
  );

  const conversation = await Conversation.findById(call.conversationId).lean();
  const initiator = await PulseUser.findById(call.initiatedBy).lean();
  const message = await writeCallLog({ call, logKind, durationSeconds });
  const publicCall = await publishCallConv(call, "call.ended", { logMessage: message });

  const participants = await CallParticipant.find({ callId: call._id }).lean();
  const memberIds = participants.map((row) => row.userId.toString());

  if (logKind === "missed") {
    await Promise.all(
      memberIds.map(async (targetUserId) => {
        await publishRealtime({
          channel: pulseChannel.inbox(targetUserId),
          event: "inbox.call.missed",
          data: { callId: call._id.toString(), conversationId: call.conversationId.toString() },
        });
        if (targetUserId === call.initiatedBy.toString()) return;
        await notifyMissed({
          targetUserId,
          call,
          conversationKind: conversation?.kind ?? "dm",
          message,
          initiatedByName: initiator?.displayName ?? "Someone",
        });
      }),
    );
  } else {
    const event = logKind === "cancelled" || logKind === "declined" ? "inbox.call.cancelled" : "inbox.call.ended";
    await Promise.all(
      memberIds.map((targetUserId) =>
        publishRealtime({
          channel: pulseChannel.inbox(targetUserId),
          event,
          data: {
            callId: call._id.toString(),
            conversationId: call.conversationId.toString(),
            reason,
          },
        }),
      ),
    );
  }

  await deleteSfuRoom(call._id.toString()).catch(() => undefined);
  return publicCall;
}

export async function expireIfStale(call: CallDoc): Promise<CallDoc> {
  if (call.status !== "ringing") return call;
  const timeout = call.ringTimeoutMs ?? DEFAULT_RING_TIMEOUT_MS;
  if (Date.now() < call.createdAt.getTime() + timeout) return call;
  await finalizeCall(call, "timeout");
  const fresh = await Call.findById(call._id);
  if (!fresh) throw new ApiError(404, "not_found", "Call not found");
  return fresh;
}

async function loadCallForUser(userId: string, callId: string): Promise<CallDoc> {
  const call = await Call.findById(callId);
  if (!call) throw new ApiError(404, "not_found", "Call not found");
  await conversationAccessContext(userId, call.conversationId.toString());
  const participant = await CallParticipant.findOne({
    callId: call._id,
    userId: oid(userId),
  }).lean();
  if (!participant) {
    throw new ApiError(404, "not_found", "Call not found");
  }
  return expireIfStale(call);
}

export async function loadCallWithConversationAccess(
  userId: string,
  callId: string,
): Promise<CallDoc> {
  const call = await Call.findById(callId);
  if (!call) throw new ApiError(404, "not_found", "Call not found");
  await conversationAccessContext(userId, call.conversationId.toString());
  return expireIfStale(call);
}

export async function isCallModerator(
  userId: string,
  call: { initiatedBy: { toString(): string } },
  conversation: Pick<ConversationDocument, "createdById" | "workspaceId">,
): Promise<boolean> {
  if (call.initiatedBy.toString() === userId) return true;
  if (conversation.createdById.toString() === userId) return true;
  if (!conversation.workspaceId) return false;
  const membership = await WorkspaceMember.findOne({
    workspaceId: conversation.workspaceId,
    userId: oid(userId),
  }).lean();
  if (!membership) return false;
  return can(membership.role as MemberRole, "message.moderate");
}

async function requireJoinedParticipant(userId: string, callId: string) {
  const call = await loadCallForUser(userId, callId);
  const participant = await CallParticipant.findOne({
    callId: call._id,
    userId: oid(userId),
  });
  if (!participant?.joinedAt || participant.leftAt) {
    throw new ApiError(403, "forbidden", "You must join the call first");
  }
  return { call, participant };
}

function isLiveStatus(status: string): boolean {
  return LIVE_CALL_STATUSES.includes(status as (typeof LIVE_CALL_STATUSES)[number]);
}

export async function listLiveCallCaps(userId: string): Promise<string[]> {
  const rows = await CallParticipant.find({
    userId: oid(userId),
    leftAt: null,
  })
    .select("callId")
    .lean();
  if (rows.length === 0) return [];
  const live = await Call.find({
    _id: { $in: rows.map((row) => row.callId) },
    status: { $in: [...LIVE_CALL_STATUSES] },
  })
    .select("_id")
    .lean();
  return live.map((row) => row._id.toString());
}

export async function createCallForUser(
  userId: string,
  input: { conversationId: string; type: CallType; clientNonce: string },
): Promise<CallPublic> {
  const existingNonce = await Call.findOne({
    initiatedBy: oid(userId),
    clientNonce: input.clientNonce,
  });
  if (existingNonce) return hydrateCall(existingNonce);

  const { conversation } = await conversationAccessContext(userId, input.conversationId);
  const live = await findLiveCall(input.conversationId);
  if (live) {
    const stale = await expireIfStale(live);
    if (isLiveStatus(stale.status)) {
      const mine = await CallParticipant.findOne({
        callId: stale._id,
        userId: oid(userId),
      }).lean();
      if (mine) return hydrateCall(stale);
      throw new ApiError(409, "call_in_progress", "A call is already in progress");
    }
  }

  if (await userIsBusy(userId)) {
    throw new ApiError(409, "already_in_call", "You are already in a call");
  }

  const memberIds = await memberIdsForConversation(conversation);
  if (!memberIds.includes(userId)) memberIds.push(userId);
  if (conversation.kind === "dm" && memberIds.length < 2) {
    throw new ApiError(400, "invalid_request", "Direct message is missing a participant");
  }

  const others = memberIds.filter((id) => id !== userId);
  if (conversation.kind === "dm" && others[0] && (await userIsBusy(others[0]))) {
    throw new ApiError(409, "callee_busy", "The other person is already in a call");
  }

  const isChannel = conversation.kind === "channel";
  const mediaPath = conversation.kind === "dm" ? "p2p" : "sfu";
  let created: CallDoc;
  try {
    created = await Call.create({
      conversationId: conversation._id,
      workspaceId: conversation.workspaceId ?? null,
      initiatedBy: oid(userId),
      type: input.type,
      status: isChannel ? "connecting" : "ringing",
      mediaPath,
      recording: false,
      ringTimeoutMs: DEFAULT_RING_TIMEOUT_MS,
      clientNonce: input.clientNonce,
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      const again = await findLiveCall(input.conversationId);
      if (again) return hydrateCall(again);
    }
    throw error;
  }

  if (isChannel) {
    await CallParticipant.create({
      callId: created._id,
      userId: oid(userId),
      joinedAt: new Date(),
      leftAt: null,
      isMuted: false,
      isVideoOn: input.type === "video",
      isPresenting: false,
      handRaised: false,
      role: "host",
    });
  } else {
    await CallParticipant.insertMany(
      memberIds.map((id) => ({
        callId: created._id,
        userId: oid(id),
        joinedAt: id === userId ? new Date() : null,
        leftAt: null,
        isMuted: false,
        isVideoOn: input.type === "video" && id === userId,
        isPresenting: false,
        handRaised: false,
        role: id === userId ? "host" : "guest",
      })),
    );
  }

  if (mediaPath === "sfu") {
    try {
      await ensureSfuRoom(created._id.toString());
    } catch (error) {
      await CallParticipant.deleteMany({ callId: created._id });
      await Call.deleteOne({ _id: created._id });
      throw error;
    }
  }

  const initiator = await PulseUser.findById(userId).lean();
  const publicCall = await publishCallConv(created, "call.started");
  await Promise.all(
    others.map((targetUserId) =>
      notifyIncoming({
        targetUserId,
        call: created,
        conversationKind: conversation.kind,
        initiatedByName: initiator?.displayName ?? "Someone",
        ring: !isChannel,
        notifyIfPrefAll: isChannel,
      }),
    ),
  );
  return publicCall;
}

export async function getCallForUser(userId: string, callId: string): Promise<CallPublic> {
  const call = await loadCallForUser(userId, callId);
  return hydrateCall(call);
}

export async function getActiveCallForUser(
  userId: string,
  conversationId: string,
): Promise<CallPublic | null> {
  await conversationAccessContext(userId, conversationId);
  const live = await findLiveCall(conversationId);
  if (!live) return null;
  const fresh = await expireIfStale(live);
  if (!LIVE_CALL_STATUSES.includes(fresh.status as (typeof LIVE_CALL_STATUSES)[number])) {
    return null;
  }
  return hydrateCall(fresh);
}

export async function acceptCallForUser(userId: string, callId: string): Promise<CallPublic> {
  const call = await loadCallForUser(userId, callId);
  if (call.status !== "ringing" && call.status !== "connecting") {
    throw new ApiError(409, "call_not_ringing", "This call is no longer ringing");
  }
  if (call.initiatedBy.toString() === userId) {
    throw new ApiError(400, "invalid_request", "You cannot accept your own call");
  }
  const participant = await CallParticipant.findOne({
    callId: call._id,
    userId: oid(userId),
  });
  if (!participant) throw new ApiError(404, "not_found", "Call not found");
  participant.joinedAt = participant.joinedAt ?? new Date();
  participant.isVideoOn = call.type === "video";
  await participant.save();
  if (call.status === "ringing") {
    call.status = "connecting";
    await call.save();
  }
  const publicCall = await publishCallConv(call, "call.updated");
  await publishRealtime({
    channel: pulseChannel.conv(call.conversationId.toString()),
    event: "call.participant-joined",
    data: {
      callId: call._id.toString(),
      participant: publicCall.participants.find((row) => row.userId === userId),
    },
  });
  await publishRealtime({
    channel: pulseChannel.inbox(call.initiatedBy.toString()),
    event: "inbox.call.accepted",
    data: { callId: call._id.toString(), conversationId: call.conversationId.toString() },
  });
  return publicCall;
}

export async function declineCallForUser(userId: string, callId: string): Promise<CallPublic> {
  const call = await loadCallForUser(userId, callId);
  if (call.initiatedBy.toString() === userId) {
    return finalizeCall(call, "hangup");
  }
  if (call.status !== "ringing") {
    throw new ApiError(409, "call_not_ringing", "This call is no longer ringing");
  }
  return finalizeCall(call, "declined");
}

export async function endCallForUser(userId: string, callId: string): Promise<CallPublic> {
  const call = await loadCallWithConversationAccess(userId, callId);
  const conversation = await Conversation.findById(call.conversationId).lean();
  if (!conversation) throw new ApiError(404, "not_found", "Conversation not found");
  if (await isCallModerator(userId, call, conversation)) {
    return finalizeCall(call, "hangup");
  }
  return leaveCallForUser(userId, callId);
}

export async function markCallConnectedForUser(userId: string, callId: string): Promise<CallPublic> {
  const call = await loadCallForUser(userId, callId);
  if (call.status === "ended" || call.status === "missed") {
    throw new ApiError(409, "call_ended", "This call has ended");
  }
  if (call.status !== "active") {
    call.status = "active";
    call.startedAt = call.startedAt ?? new Date();
    await call.save();
    await publishRealtime({
      channel: pulseChannel.inbox(call.initiatedBy.toString()),
      event: "inbox.call.accepted",
      data: { callId: call._id.toString(), conversationId: call.conversationId.toString() },
    });
  }
  return publishCallConv(call, "call.updated");
}

export async function joinCallForUser(userId: string, callId: string): Promise<CallPublic> {
  const call = await loadCallWithConversationAccess(userId, callId);
  if (!isLiveStatus(call.status)) {
    throw new ApiError(409, "call_ended", "This call has ended");
  }

  const now = new Date();
  const existing = await CallParticipant.findOne({
    callId: call._id,
    userId: oid(userId),
  });
  if (existing) {
    if (existing.leftAt || !existing.joinedAt) {
      existing.joinedAt = existing.leftAt ? now : (existing.joinedAt ?? now);
      existing.leftAt = null;
      existing.isVideoOn = call.type === "video";
      await existing.save();
    }
  } else {
    await CallParticipant.create({
      callId: call._id,
      userId: oid(userId),
      joinedAt: now,
      leftAt: null,
      isMuted: false,
      isVideoOn: call.type === "video",
      isPresenting: false,
      handRaised: false,
      role: call.initiatedBy.toString() === userId ? "host" : "guest",
    });
  }

  if (call.mediaPath === "sfu" && call.status === "ringing") {
    call.status = "connecting";
    await call.save();
  }

  const publicCall = await publishCallConv(call, "call.updated");
  await publishRealtime({
    channel: pulseChannel.conv(call.conversationId.toString()),
    event: "call.participant-joined",
    data: {
      callId: call._id.toString(),
      participant: publicCall.participants.find((row) => row.userId === userId),
    },
  });
  return publicCall;
}

export async function leaveCallForUser(userId: string, callId: string): Promise<CallPublic> {
  const call = await loadCallForUser(userId, callId);
  if (!isLiveStatus(call.status)) {
    return hydrateCall(call);
  }

  const participant = await CallParticipant.findOne({
    callId: call._id,
    userId: oid(userId),
  });
  if (!participant) throw new ApiError(404, "not_found", "Call not found");

  if (!participant.leftAt) {
    participant.leftAt = new Date();
    participant.isPresenting = false;
    await participant.save();
  }

  if (call.presenterUserId?.toString() === userId) {
    call.presenterUserId = null;
    await call.save();
  }

  await publishRealtime({
    channel: pulseChannel.conv(call.conversationId.toString()),
    event: "call.participant-left",
    data: {
      callId: call._id.toString(),
      userId,
      reason: "hangup",
    },
  });

  const remaining = await CallParticipant.countDocuments({
    callId: call._id,
    joinedAt: { $ne: null },
    leftAt: null,
  });
  if (remaining === 0) {
    return finalizeCall(call, "hangup");
  }
  return publishCallConv(call, "call.updated");
}

export async function upgradeCallToSfuForUser(
  userId: string,
  callId: string,
): Promise<CallPublic> {
  const { call } = await requireJoinedParticipant(userId, callId);
  if (call.mediaPath === "sfu") {
    return hydrateCall(call);
  }
  await ensureSfuRoom(call._id.toString());
  call.mediaPath = "sfu";
  await call.save();
  const publicCall = await publishCallConv(call, "call.updated");
  await publishRealtime({
    channel: pulseChannel.call(call._id.toString()),
    event: "call.path-changed",
    data: { mediaPath: "sfu", reason: "kind-changed" },
    ephemeral: true,
  });
  return publicCall;
}

export async function setPresenterForUser(
  userId: string,
  callId: string,
  targetUserId: string | null,
): Promise<CallPublic> {
  const { call } = await requireJoinedParticipant(userId, callId);
  const conversation = await Conversation.findById(call.conversationId).lean();
  if (!conversation) throw new ApiError(404, "not_found", "Conversation not found");

  const current = call.presenterUserId?.toString() ?? null;
  const moderator = await isCallModerator(userId, call, conversation);

  if (targetUserId) {
    const target = await CallParticipant.findOne({
      callId: call._id,
      userId: oid(targetUserId),
      joinedAt: { $ne: null },
      leftAt: null,
    });
    if (!target) {
      throw new ApiError(404, "not_found", "Presenter target is not in this call");
    }
    if (current && current !== targetUserId) {
      if (current !== userId && !moderator) {
        throw new ApiError(409, "presenter_taken", "Someone is already presenting");
      }
    }
    call.presenterUserId = oid(targetUserId);
    await CallParticipant.updateMany({ callId: call._id }, { $set: { isPresenting: false } });
    target.isPresenting = true;
    await target.save();
  } else {
    if (current && current !== userId && !moderator) {
      throw new ApiError(403, "forbidden", "Only the presenter or a moderator can clear the presenter");
    }
    call.presenterUserId = null;
    await CallParticipant.updateMany({ callId: call._id }, { $set: { isPresenting: false } });
  }

  await call.save();
  const publicCall = await publishCallConv(call, "call.updated");
  await publishRealtime({
    channel: pulseChannel.call(call._id.toString()),
    event: "call.presenter-changed",
    data: { userId: targetUserId },
    ephemeral: true,
  });
  return publicCall;
}

export async function muteParticipantForUser(
  moderatorId: string,
  callId: string,
  targetUserId: string,
): Promise<CallPublic> {
  const call = await loadCallWithConversationAccess(moderatorId, callId);
  if (!isLiveStatus(call.status)) {
    throw new ApiError(409, "call_ended", "This call has ended");
  }
  const conversation = await Conversation.findById(call.conversationId).lean();
  if (!conversation) throw new ApiError(404, "not_found", "Conversation not found");
  if (!(await isCallModerator(moderatorId, call, conversation))) {
    throw new ApiError(403, "forbidden", "Only a moderator can mute another participant");
  }

  const target = await CallParticipant.findOne({
    callId: call._id,
    userId: oid(targetUserId),
  });
  if (!target) throw new ApiError(404, "not_found", "Participant not found");
  target.isMuted = true;
  await target.save();

  if (call.mediaPath === "sfu") {
    try {
      const room = await getSfuRoom(call._id.toString());
      const audio = room.producers.find(
        (producer) => producer.userId === targetUserId && producer.kind === "audio",
      );
      if (audio) await pauseSfuProducer(call._id.toString(), audio.producerId);
    } catch {
      /* event is enough for v1 */
    }
  }

  await publishRealtime({
    channel: pulseChannel.call(call._id.toString()),
    event: "call.moderation.mute",
    data: { targetUserId, isMuted: true, byUserId: moderatorId },
    ephemeral: true,
  });
  return publishCallConv(call, "call.updated");
}

export async function sfuJoinForUser(
  userId: string,
  callId: string,
): Promise<Pick<SfuRoomSnapshot, "routerRtpCapabilities" | "producers">> {
  await requireJoinedParticipant(userId, callId);
  const room = await ensureSfuRoom(callId);
  return {
    routerRtpCapabilities: room.routerRtpCapabilities,
    producers: room.producers,
  };
}

export async function sfuCreateTransportForUser(
  userId: string,
  callId: string,
  direction: SfuTransportDirection,
): Promise<SfuTransportInfo> {
  await requireJoinedParticipant(userId, callId);
  return createSfuTransport(callId, userId, direction);
}

export async function sfuConnectTransportForUser(
  userId: string,
  callId: string,
  transportId: string,
  dtlsParameters: SfuDtlsParameters,
): Promise<void> {
  await requireJoinedParticipant(userId, callId);
  await connectSfuTransport(callId, transportId, dtlsParameters);
}

export async function sfuProduceForUser(
  userId: string,
  callId: string,
  input: {
    transportId: string;
    kind: SfuMediaKind;
    rtpParameters: SfuRtpParameters;
    source: SfuTrackSource;
  },
): Promise<{ producerId: string }> {
  await requireJoinedParticipant(userId, callId);
  return sfuProduce(callId, { userId, ...input });
}

export async function sfuConsumeForUser(
  userId: string,
  callId: string,
  input: { producerId: string; rtpCapabilities: SfuRtpCapabilities },
): Promise<SfuConsumeResult> {
  await requireJoinedParticipant(userId, callId);
  return sfuConsume(callId, { userId, ...input });
}

export async function sfuResumeConsumerForUser(
  userId: string,
  callId: string,
  consumerId: string,
): Promise<void> {
  await requireJoinedParticipant(userId, callId);
  await resumeSfuConsumer(callId, consumerId);
}

export async function sfuSetConsumerLayersForUser(
  userId: string,
  callId: string,
  consumerId: string,
  layers: { spatialLayer: number; temporalLayer?: number },
): Promise<void> {
  await requireJoinedParticipant(userId, callId);
  await setSfuConsumerLayers(callId, consumerId, layers);
}
