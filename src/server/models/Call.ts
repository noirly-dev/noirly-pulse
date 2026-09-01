import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  CALL_END_REASONS,
  CALL_MEDIA_PATHS,
  CALL_STATUSES,
  CALL_TYPES,
  LIVE_CALL_STATUSES,
} from "@/src/core/models/enums";
import { DEFAULT_RING_TIMEOUT_MS } from "@/src/core/calls/constants";

const callSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },
    initiatedBy: {
      type: Schema.Types.ObjectId,
      ref: "PulseUser",
      required: true,
    },
    type: { type: String, enum: CALL_TYPES, required: true },
    status: { type: String, enum: CALL_STATUSES, required: true, index: true },
    mediaPath: { type: String, enum: CALL_MEDIA_PATHS, required: true },
    presenterUserId: {
      type: Schema.Types.ObjectId,
      ref: "PulseUser",
      default: null,
    },
    recording: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    endReason: { type: String, enum: CALL_END_REASONS, default: null },
    ringTimeoutMs: { type: Number, default: DEFAULT_RING_TIMEOUT_MS },
    clientNonce: { type: String, required: true },
  },
  { timestamps: true },
);

callSchema.index({ initiatedBy: 1, clientNonce: 1 }, { unique: true });
callSchema.index({ conversationId: 1, createdAt: -1 });
callSchema.index(
  { conversationId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: [...LIVE_CALL_STATUSES] } },
  },
);

export type CallDocument = InferSchemaType<typeof callSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Call: Model<CallDocument> =
  (models.Call as Model<CallDocument>) || model<CallDocument>("Call", callSchema, "calls");
