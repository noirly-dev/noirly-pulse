"use client";

import { RealtimeClient } from "@noirly-dev/realtime-client";
import { RealtimeProvider } from "@noirly-dev/realtime-client/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { pulseChannel } from "@/src/core/realtime/channels";
import { create } from "zustand";

type Scope = {
  workspaceId: string | null;
  conversationId: string | null;
  callId: string | null;
  setScope: (workspaceId: string | null, conversationId: string | null) => void;
  setCallId: (callId: string | null) => void;
};

export const useRealtimeScope = create<Scope>((set) => ({
  workspaceId: null,
  conversationId: null,
  callId: null,
  setScope: (workspaceId, conversationId) => set({ workspaceId, conversationId }),
  setCallId: (callId) => set({ callId }),
}));

export function setRealtimeScope(
  workspaceId: string | null,
  conversationId: string | null,
): void {
  useRealtimeScope.getState().setScope(workspaceId, conversationId);
}

export function setRealtimeCallId(callId: string | null): void {
  useRealtimeScope.getState().setCallId(callId);
}

/** Channel caps in the most recently minted token (null until the first mint). */
let tokenCaps: Set<string> | null = null;
let remint: (() => void) | null = null;

function decodeCaps(token: string): Set<string> | null {
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { caps?: Record<string, unknown> };
    return new Set(Object.keys(payload.caps ?? {}));
  } catch {
    return null;
  }
}

function channelsForScope(scope: Pick<Scope, "workspaceId" | "conversationId" | "callId">) {
  const channels: string[] = [];
  if (scope.workspaceId) channels.push(pulseChannel.workspace(scope.workspaceId));
  if (scope.conversationId) {
    channels.push(pulseChannel.conv(scope.conversationId), pulseChannel.typing(scope.conversationId));
  }
  if (scope.callId) channels.push(pulseChannel.call(scope.callId));
  return channels;
}

/**
 * Reconnect (and so re-mint) only when the current token lacks a channel the
 * scope needs (§5.5 step 4). Switching between conversations already covered
 * by the token keeps the socket, instead of tearing it down on every click.
 */
function ensureScopeCovered(): void {
  if (!tokenCaps || !remint) return;
  const missing = channelsForScope(useRealtimeScope.getState()).some((c) => !tokenCaps!.has(c));
  if (missing) remint();
}

async function fetchRealtimeToken(): Promise<string> {
  const { workspaceId, conversationId, callId } = useRealtimeScope.getState();
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspaceId", workspaceId);
  if (conversationId) params.set("conversationId", conversationId);
  if (callId) params.set("callId", callId);
  const qs = params.toString();
  const res = await fetch(`/api/realtime/token${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    throw new Error("Failed to mint realtime token");
  }
  const json = (await res.json()) as { token: string };
  tokenCaps = decodeCaps(json.token);
  // The scope may have changed while this token was being minted.
  queueMicrotask(ensureScopeCovered);
  return json.token;
}

export function PulseRealtimeProvider({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_REALTIME_WS_URL;
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    remint = () => {
      tokenCaps = null;
      setGeneration((g) => g + 1);
    };
    const unsubscribe = useRealtimeScope.subscribe(ensureScopeCovered);
    return () => {
      unsubscribe();
      remint = null;
    };
  }, []);

  const client = useMemo(() => {
    if (!url) return null;
    return new RealtimeClient({
      url,
      getToken: fetchRealtimeToken,
    });
    // `generation` forces a fresh client (and token) when the scope outgrows it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, generation]);

  useEffect(() => {
    return () => {
      client?.disconnect();
    };
  }, [client]);

  if (!client) return children;

  return (
    <RealtimeProvider client={client} autoConnect={false}>
      {children}
    </RealtimeProvider>
  );
}
