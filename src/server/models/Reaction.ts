import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";

const reactionSchema = new Schema(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: true,
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "PulseUser",
      required: true,
    },
    emoji: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

reactionSchema.index({ messageId: 1, userId: 1, emoji: 1 }, { unique: true });

export type ReactionDocument = InferSchemaType<typeof reactionSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
};

export const Reaction: Model<ReactionDocument> =
  (models.Reaction as Model<ReactionDocument>) ||
  model<ReactionDocument>("Reaction", reactionSchema, "reactions");
