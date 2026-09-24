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

// Partial, not sparse: every channel/group DM stores explicit `dmKey: null` and
// `slug: null`, and a sparse index still indexes explicit nulls, so a sparse
// unique index allowed only one such conversation in the whole database.
export const CONVERSATION_UNIQUE_INDEXES = [
  {
    name: "dmKey_1",
    key: { dmKey: 1 },
    partialFilterExpression: { dmKey: { $type: "string" } },
  },
  {
    name: "workspaceId_1_slug_1",
    key: { workspaceId: 1, slug: 1 },
    partialFilterExpression: { slug: { $type: "string" } },
  },
] as const;

for (const index of CONVERSATION_UNIQUE_INDEXES) {
  conversationSchema.index(index.key, {
    name: index.name,
    unique: true,
    partialFilterExpression: index.partialFilterExpression,
  });
}
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
