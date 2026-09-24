import type mongoose from "mongoose";
import { CONVERSATION_UNIQUE_INDEXES } from "@/src/server/models/Conversation";

/**
 * Replace legacy `sparse` unique indexes on conversations with the partial
 * ones the schema declares. Mongoose's autoIndex will not change the options
 * of an index that already exists under the same name, so older databases
 * keep rejecting a second channel / group DM until the index is rebuilt.
 * Idempotent and cheap: it only inspects index metadata.
 */
export async function migrateConversationIndexes(conn: typeof mongoose): Promise<void> {
  const db = conn.connection.db;
  if (!db) return;
  const collection = db.collection("conversations");
  let existing: Array<{ name?: string; sparse?: boolean; partialFilterExpression?: unknown }>;
  try {
    existing = await collection.indexes();
  } catch {
    return; // collection does not exist yet; autoIndex will create it correctly
  }
  for (const wanted of CONVERSATION_UNIQUE_INDEXES) {
    const current = existing.find((index) => index.name === wanted.name);
    if (current && !current.partialFilterExpression) {
      await collection.dropIndex(wanted.name);
    }
    if (!current || !current.partialFilterExpression) {
      await collection.createIndex(wanted.key, {
        name: wanted.name,
        unique: true,
        partialFilterExpression: wanted.partialFilterExpression,
      });
    }
  }
}
