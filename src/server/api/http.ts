import { Types } from "mongoose";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { ensurePulseAccount } from "@/src/server/auth/bootstrap";
import { createMongoSyncProvider } from "@/src/server/providers/mongo-sync-provider";

export type PulseSessionContext = {
  identitySub: string;
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export async function requirePulseSession(): Promise<PulseSessionContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ApiError(401, "unauthorized", "Sign in required");
  }

  const account = await ensurePulseAccount({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  });

  return {
    identitySub: account.user.identitySub,
    userId: account.user.id,
    email: account.user.email,
    displayName: account.user.displayName,
    avatarUrl: account.user.avatarUrl,
  };
}

export async function getSyncProvider() {
  const ctx = await requirePulseSession();
  return {
    ctx,
    sync: createMongoSyncProvider({ userId: ctx.userId }),
  };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: "invalid_request",
        message: error.issues[0]?.message ?? "Validation failed",
      },
      { status: 400 },
    );
  }
  console.error(error);
  return Response.json(
    { error: "internal_error", message: "Something went wrong" },
    { status: 500 },
  );
}

export async function assertObjectId(id: string, label = "id") {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "invalid_request", `Invalid ${label}`);
  }
}
