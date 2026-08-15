import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import { ATTACHMENT_KINDS } from "@/src/core/models/enums";

const attachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    kind: { type: String, enum: ATTACHMENT_KINDS, required: true },
    filename: { type: String, required: true },
    mime: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    url: { type: String, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "PulseUser",
      required: true,
    },
    content: { type: String, default: "" },
    mentionedUserIds: [{ type: Schema.Types.ObjectId, ref: "PulseUser" }],
    attachments: { type: [attachmentSchema], default: [] },
    threadParentId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    replyCount: { type: Number, default: 0 },
    lastReplyAt: { type: Date, default: null },
    clientNonce: { type: String, required: true },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

messageSchema.index({ senderId: 1, clientNonce: 1 }, { unique: true });
messageSchema.index({ conversationId: 1, threadParentId: 1, createdAt: 1 });
messageSchema.index({ content: "text" });

export type MessageDocument = InferSchemaType<typeof messageSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Message: Model<MessageDocument> =
  (models.Message as Model<MessageDocument>) ||
  model<MessageDocument>("Message", messageSchema, "messages");
