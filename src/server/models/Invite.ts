import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";

const inviteSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ["admin", "member"],
      required: true,
    },
    tokenHash: { type: String, required: true },
    invitedById: {
      type: Schema.Types.ObjectId,
      ref: "PulseUser",
      required: true,
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type InviteDocument = InferSchemaType<typeof inviteSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
};

export const Invite: Model<InviteDocument> =
  (models.Invite as Model<InviteDocument>) ||
  model<InviteDocument>("Invite", inviteSchema, "invites");
