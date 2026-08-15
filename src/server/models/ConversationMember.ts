import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import { NOTIFICATION_PREFS } from "@/src/core/models/enums";

const conversationMemberSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "PulseUser",
      required: true,
      index: true,
    },
    joinedAt: { type: Date, default: Date.now },
    lastReadMessageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastReadAt: { type: Date, default: null },
    mutedUntil: { type: Date, default: null },
    notifications: {
      type: String,
      enum: NOTIFICATION_PREFS,
      default: "all",
    },
  },
  { timestamps: true },
);

conversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
conversationMemberSchema.index({ userId: 1, lastReadAt: -1 });

export type ConversationMemberDocument = InferSchemaType<
  typeof conversationMemberSchema
> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const ConversationMember: Model<ConversationMemberDocument> =
  (models.ConversationMember as Model<ConversationMemberDocument>) ||
  model<ConversationMemberDocument>(
    "ConversationMember",
    conversationMemberSchema,
    "conversation_members",
  );
