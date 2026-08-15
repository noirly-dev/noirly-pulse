import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import { NOTIFICATION_PREFS } from "@/src/core/models/enums";

const userSchema = new Schema(
  {
    identitySub: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    emailVerified: { type: Boolean, default: false },
    displayName: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: null },
    lastSeenAt: { type: Date, default: null },
    defaultNotificationPref: {
      type: String,
      enum: NOTIFICATION_PREFS,
      default: "all",
    },
  },
  { timestamps: true },
);

export type PulseUserDocument = InferSchemaType<typeof userSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const PulseUser: Model<PulseUserDocument> =
  (models.PulseUser as Model<PulseUserDocument>) ||
  model<PulseUserDocument>("PulseUser", userSchema, "users");
