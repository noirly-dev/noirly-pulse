"use client";

import { useEffect, useState } from "react";
import type { ChannelName, EventId } from "@noirly-dev/realtime-shared";
import type { SubscribeOptions } from "@noirly-dev/realtime-client";
import { useRealtimeClient, useRealtimeStatus } from "@noirly-dev/realtime-client/react";

/**
 * Drop-in for `useChannel` from `@noirly-dev/realtime-client/react`.
 *
 * The upstream hook calls `sub.unsubscribe()` when a subscribe resolves after
 * its effect was cleaned up. Subscriptions are keyed by channel (not ref-counted),
 * so under StrictMode or a quick remount the sequence
 *   subscribe → unsubscribe (cleanup) → subscribe → [first resolves] unsubscribe
 * leaves the socket unsubscribed and the tab silently stops receiving messages.
 * The cleanup has already unsubscribed, so a stale resolution only needs to be ignored.
 */
const clientIds = new WeakMap<object, number>();
let nextClientId = 0;
function clientId(client: object): number {
  let id = clientIds.get(client);
  if (id === undefined) {
    id = ++nextClientId;
    clientIds.set(client, id);
  }
  return id;
}

export function useChannel(
  channel: ChannelName | null,
  opts?: SubscribeOptions,
): { lastEventId: EventId | null; status: "idle" | "subscribed" | "error" } {
  const client = useRealtimeClient();
  const connStatus = useRealtimeStatus();
  const [state, setState] = useState<{
    key: string | null;
    status: "subscribed" | "error";
    lastEventId: EventId | null;
  }>({ key: null, status: "error", lastEventId: null });

  const presence = opts?.presence;
  const lastEventId = opts?.lastEventId;
  const replayLimit = opts?.replayLimit;
  const key = channel && connStatus === "ready" ? `${channel}|${clientId(client)}` : null;

  useEffect(() => {
    if (!channel || connStatus !== "ready") return;
    let cancelled = false;
    const effectKey = `${channel}|${clientId(client)}`;
    client
      .subscribe(channel, { presence, lastEventId, replayLimit })
      .then((sub) => {
        if (cancelled) return;
        setState({ key: effectKey, status: "subscribed", lastEventId: sub.lastEventId });
      })
      .catch(() => {
        if (!cancelled) setState({ key: effectKey, status: "error", lastEventId: null });
      });
    return () => {
      cancelled = true;
      client.unsubscribe(channel).catch(() => undefined);
    };
  }, [client, channel, connStatus, presence, lastEventId, replayLimit]);

  // Status belongs to the current (channel, connection) pair only.
  if (!key || state.key !== key) return { lastEventId: null, status: "idle" };
  return { lastEventId: state.lastEventId, status: state.status };
}
