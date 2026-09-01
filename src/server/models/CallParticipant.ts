import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";

const callParticipantSchema = new Schema(
  {
    callId: {
      type: Schema.Types.ObjectId,
      ref: "Call",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "PulseUser",
      required: true,
      index: true,
    },
    joinedAt: { type: Date, default: null },
    leftAt: { type: Date, default: null },
    isMuted: { type: Boolean, default: false },
    isVideoOn: { type: Boolean, default: false },
    isPresenting: { type: Boolean, default: false },
    handRaised: { type: Boolean, default: false },
    role: { type: String, enum: ["host", "guest"], required: true },
  },
  { timestamps: true },
);

callParticipantSchema.index({ callId: 1, userId: 1 }, { unique: true });

export type CallParticipantDocument = InferSchemaType<typeof callParticipantSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const CallParticipant: Model<CallParticipantDocument> =
  (models.CallParticipant as Model<CallParticipantDocument>) ||
  model<CallParticipantDocument>(
    "CallParticipant",
    callParticipantSchema,
    "call_participants",
  );
