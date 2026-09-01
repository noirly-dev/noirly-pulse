import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import { NOTIFICATION_KINDS } from "@/src/core/models/enums";

const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "PulseUser",
      required: true,
      index: true,
    },
    kind: { type: String, enum: NOTIFICATION_KINDS, required: true },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "PulseUser",
      required: true,
    },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export type NotificationDocument = InferSchemaType<typeof notificationSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
};

export const Notification: Model<NotificationDocument> =
  (models.Notification as Model<NotificationDocument>) ||
  model<NotificationDocument>("Notification", notificationSchema, "notifications");
