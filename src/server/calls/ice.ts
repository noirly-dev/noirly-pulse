import { createHmac } from "node:crypto";
import {
  DEFAULT_TURN_TTL_SECONDS,
  parseIceUrlList,
  type IceServer,
} from "@/src/core/calls/ice";

export type IceEnv = {
  STUN_URLS?: string;
  TURN_URLS?: string;
  TURN_SECRET?: string;
  TURN_TTL_SECONDS?: string;
  TURN_USERNAME?: string;
  TURN_PASSWORD?: string;
};

export function mintTurnUsername(userId: string, nowMs = Date.now(), ttlSeconds = DEFAULT_TURN_TTL_SECONDS) {
  const expiry = Math.floor(nowMs / 1000) + ttlSeconds;
  return { expiry, username: `${expiry}:${userId}` };
}

export function mintTurnCredential(secret: string, username: string): string {
  return createHmac("sha1", secret).update(username).digest("base64");
}

/** Time-limited coturn REST credentials (`use-auth-secret`). */
export function mintIceServers(
  userId: string,
  env: IceEnv = process.env as IceEnv,
  nowMs = Date.now(),
): IceServer[] {
  const stunUrls = parseIceUrlList(env.STUN_URLS);
  const turnUrls = parseIceUrlList(env.TURN_URLS);
  const servers: IceServer[] = [];
  if (stunUrls.length) servers.push({ urls: stunUrls });

  if (turnUrls.length === 0) return servers;

  const secret = env.TURN_SECRET;
  const ttl = Number(env.TURN_TTL_SECONDS ?? DEFAULT_TURN_TTL_SECONDS) || DEFAULT_TURN_TTL_SECONDS;
  if (secret) {
    const { username } = mintTurnUsername(userId, nowMs, ttl);
    servers.push({
      urls: turnUrls,
      username,
      credential: mintTurnCredential(secret, username),
    });
    return servers;
  }

  const username = env.TURN_USERNAME;
  const credential = env.TURN_PASSWORD;
  if (username && credential) {
    servers.push({ urls: turnUrls, username, credential });
  } else {
    servers.push({ urls: turnUrls });
  }
  return servers;
}
