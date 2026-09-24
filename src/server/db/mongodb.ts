import mongoose from "mongoose";
import { migrateConversationIndexes } from "@/src/server/db/migrate-indexes";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var pulseMongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.pulseMongooseCache ?? {
  conn: null,
  promise: null,
};

global.pulseMongooseCache = cache;

export async function connectMongo(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required (use database name noirly-pulse)");
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
      })
      .then(async (conn) => {
        await migrateConversationIndexes(conn).catch((error) => {
          console.error("[pulse] conversation index migration failed", error);
        });
        return conn;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

export async function withDb<T>(fn: () => Promise<T>): Promise<T> {
  await connectMongo();
  return fn();
}
