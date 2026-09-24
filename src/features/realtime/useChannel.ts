"use client";

import { useEffect, useState } from "react";
import type { ChannelName, EventId } from "@noirly-dev/realtime-shared";
import type { RealtimeClient, SubscribeOptions } from "@noirly-dev/realtime-client";
import { useRealtimeClient, useRealtimeStatus } from "@noirly-dev/realtime-client/react";

/**
 * Drop-in for `useChannel` from `@noirly-dev/realtime-client/react`, with
 * reference-counted subscriptions.
 *
 * Upstream subscribes/unsubscribes on every effect run. Under React StrictMode,
 * quick remounts, or reconnect churn that produces subscribe → unsubscribe →
 * subscribe for the same channel within a few ms. Two things then go wrong:
 *  - the upstream hook unsubscribes again when the first subscribe resolves
 *    after its effect was cleaned up, and
 *  - noirly-realtime's server handles subscribe asynchronously, so a fast
 *    unsubscribe can land after the second subscribe is acknowledged.
 * Either way the socket ends up unsubscribed and the tab silently stops
 * receiving messages ("not subscribed" on presence-join).
 *
 * Here each (client, channel) is subscribed once while anything holds it; the
 * unsubscribe is deferred briefly and cancelled if the channel is re-acquired.
 * Reconnects need no resubscribe: RealtimeClient restores desired channels.
 */

type Entry = {
  refs: number;
  promise: Promise<{ lastEventId: EventId | null }>;
  releaseTimer: ReturnType<typeof setTimeout> | null;
};

const RELEASE_DELAY_MS = 250;
const registry = new WeakMap<RealtimeClient, Map<string, Entry>>();
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

function acquire(client: RealtimeClient, channel: ChannelName, opts?: SubscribeOptions): Entry {
  let byChannel = registry.get(client);
  if (!byChannel) {
    byChannel = new Map();
    registry.set(client, byChannel);
  }
  let entry = byChannel.get(channel);
  if (entry) {
    if (entry.releaseTimer) {
      clearTimeout(entry.releaseTimer);
      entry.releaseTimer = null;
    }
    entry.refs += 1;
    return entry;
  }
  entry = {
    refs: 1,
    releaseTimer: null,
    promise: client.subscribe(channel, opts).then((sub) => ({ lastEventId: sub.lastEventId })),
  };
  // A failed subscribe must not be reused by the next acquirer.
  const failed = entry;
  entry.promise.catch(() => {
    if (byChannel.get(channel) === failed) byChannel.delete(channel);
  });
  byChannel.set(channel, entry);
  return entry;
}

function release(client: RealtimeClient, channel: ChannelName): void {
  const byChannel = registry.get(client);
  const entry = byChannel?.get(channel);
  if (!byChannel || !entry) return;
  entry.refs -= 1;
  if (entry.refs > 0 || entry.releaseTimer) return;
  entry.releaseTimer = setTimeout(() => {
    if (entry.refs > 0 || byChannel.get(channel) !== entry) return;
    byChannel.delete(channel);
    client.unsubscribe(channel).catch(() => undefined);
  }, RELEASE_DELAY_MS);
}

export function useChannel(
  channel: ChannelName | null,
  opts?: SubscribeOptions,
): { lastEventId: EventId | null; status: "idle" | "subscribed" | "error" } {
  const client = useRealtimeClient();
  const ready = useRealtimeStatus() === "ready";
  const [state, setState] = useState<{
    key: string | null;
    status: "subscribed" | "error";
    lastEventId: EventId | null;
  }>({ key: null, status: "error", lastEventId: null });

  const presence = opts?.presence;
  const lastEventId = opts?.lastEventId;
  const replayLimit = opts?.replayLimit;
  const key = channel && ready ? `${channel}|${clientId(client)}` : null;

  useEffect(() => {
    if (!channel || !ready) return;
    let cancelled = false;
    const effectKey = `${channel}|${clientId(client)}`;
    const entry = acquire(client, channel, { presence, lastEventId, replayLimit });
    entry.promise
      .then((sub) => {
        if (!cancelled) setState({ key: effectKey, status: "subscribed", lastEventId: sub.lastEventId });
      })
      .catch(() => {
        if (!cancelled) setState({ key: effectKey, status: "error", lastEventId: null });
      });
    return () => {
      cancelled = true;
      release(client, channel);
    };
    // Options are read when the channel is first acquired only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, channel, ready]);

  // Status belongs to the current (channel, connection) pair only.
  if (!key || state.key !== key) return { lastEventId: null, status: "idle" };
  return { lastEventId: state.lastEventId, status: state.status };
}
