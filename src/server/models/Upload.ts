import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import { ATTACHMENT_KINDS } from "@/src/core/models/enums";

const uploadSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "PulseUser",
      required: true,
      index: true,
    },
    kind: { type: String, enum: ATTACHMENT_KINDS, required: true },
    filename: { type: String, required: true },
    mime: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    storagePath: { type: String, required: true },
    url: { type: String, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { timestamps: true },
);

export type UploadDocument = InferSchemaType<typeof uploadSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Upload: Model<UploadDocument> =
  (models.Upload as Model<UploadDocument>) ||
  model<UploadDocument>("Upload", uploadSchema, "uploads");
