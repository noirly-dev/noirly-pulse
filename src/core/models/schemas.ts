import { z } from "zod";
import {
  CALL_TYPES,
  CHANNEL_VISIBILITIES,
  MEMBER_ROLES,
  NOTIFICATION_PREFS,
} from "./enums";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

export const createChannelSchema = z.object({
  name: z.string().trim().min(1).max(80),
  visibility: z.enum(CHANNEL_VISIBILITIES),
  topic: z.string().trim().max(500).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(MEMBER_ROLES).refine((role) => role !== "owner", {
    message: "Cannot assign owner via this endpoint",
  }),
});

export const createConversationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("dm"),
    userId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("group_dm"),
    userIds: z.array(z.string().min(1)).min(2).max(20),
    name: z.string().trim().max(80).optional(),
  }),
]);

export const sendMessageSchema = z.object({
  content: z.string().max(8000).default(""),
  clientNonce: z.string().min(8).max(80),
  attachmentIds: z.array(z.string().min(1)).max(8).optional(),
  threadParentId: z.string().min(1).nullable().optional(),
});

export const editMessageSchema = z.object({
  content: z.string().trim().min(1).max(8000),
});

export const toggleReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(32),
});

export const markReadSchema = z.object({
  lastReadMessageId: z.string().min(1),
});

export const createInviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["admin", "member"]),
});

export const addChannelMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(50),
});

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export const updatePreferencesSchema = z.object({
  defaultNotificationPref: z.enum(NOTIFICATION_PREFS).optional(),
});

export const updateConversationPrefSchema = z.object({
  notifications: z.enum(NOTIFICATION_PREFS),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const createCallSchema = z.object({
  conversationId: z.string().min(1),
  type: z.enum(CALL_TYPES),
  clientNonce: z.string().min(8).max(80),
});

const jsonObject = z.record(z.string(), z.unknown());

export const setCallPresenterSchema = z.object({
  userId: z.string().min(1).nullable(),
});

export const sfuTransportSchema = z.object({
  direction: z.enum(["send", "recv"]),
});

export const sfuConnectTransportSchema = z.object({
  dtlsParameters: jsonObject,
});

export const sfuProduceSchema = z.object({
  transportId: z.string().min(1),
  kind: z.enum(["audio", "video"]),
  rtpParameters: jsonObject,
  source: z.enum(["mic", "camera", "screen"]),
});

export const sfuConsumeSchema = z.object({
  producerId: z.string().min(1),
  rtpCapabilities: jsonObject,
});

export const sfuConsumerLayersSchema = z.object({
  spatialLayer: z.number().int().min(0),
  temporalLayer: z.number().int().min(0).optional(),
});
