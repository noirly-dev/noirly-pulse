import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  CHANNEL_VISIBILITIES,
  CONVERSATION_KINDS,
} from "@/src/core/models/enums";

const conversationSchema = new Schema(
  {
    kind: {
      type: String,
      enum: CONVERSATION_KINDS,
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true,
    },
    name: { type: String, default: null, trim: true },
    slug: { type: String, default: null, trim: true },
    topic: { type: String, default: null, trim: true },
    visibility: {
      type: String,
      enum: CHANNEL_VISIBILITIES,
      default: null,
    },
    dmKey: { type: String, default: null },
    archivedAt: { type: Date, default: null },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: "PulseUser",
      required: true,
    },
    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: null },
  },
  { timestamps: true },
);

conversationSchema.index({ dmKey: 1 }, { unique: true, sparse: true });
conversationSchema.index(
  { workspaceId: 1, slug: 1 },
  { unique: true, sparse: true },
);
conversationSchema.index({ workspaceId: 1, lastMessageAt: -1 });
conversationSchema.index({ kind: 1, lastMessageAt: -1 });

export type ConversationDocument = InferSchemaType<typeof conversationSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Conversation: Model<ConversationDocument> =
  (models.Conversation as Model<ConversationDocument>) ||
  model<ConversationDocument>("Conversation", conversationSchema, "conversations");
