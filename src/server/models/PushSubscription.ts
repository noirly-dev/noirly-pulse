import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";

const pushSubscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "PulseUser",
      required: true,
      index: true,
    },
    endpoint: { type: String, required: true, unique: true, trim: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    userAgent: { type: String, default: null },
  },
  { timestamps: true },
);

export type PushSubscriptionDocument = InferSchemaType<typeof pushSubscriptionSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const PushSubscription: Model<PushSubscriptionDocument> =
  (models.PushSubscription as Model<PushSubscriptionDocument>) ||
  model<PushSubscriptionDocument>(
    "PushSubscription",
    pushSubscriptionSchema,
    "push_subscriptions",
  );
