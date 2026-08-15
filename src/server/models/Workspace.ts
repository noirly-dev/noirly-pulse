import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import { WORKSPACE_KINDS } from "@/src/core/models/enums";

const workspaceSchema = new Schema(
  {
    kind: {
      type: String,
      enum: WORKSPACE_KINDS,
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, index: true },
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: "PulseUser",
      required: true,
      index: true,
    },
    iconUrl: { type: String, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type WorkspaceDocument = InferSchemaType<typeof workspaceSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Workspace: Model<WorkspaceDocument> =
  (models.Workspace as Model<WorkspaceDocument>) ||
  model<WorkspaceDocument>("Workspace", workspaceSchema, "workspaces");
