"use client";

import { RealtimeClient } from "@noirly-dev/realtime-client";
import { RealtimeProvider } from "@noirly-dev/realtime-client/react";
import { useEffect, useMemo, type ReactNode } from "react";
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
  return json.token;
}

export function PulseRealtimeProvider({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_REALTIME_WS_URL;
  const conversationId = useRealtimeScope((s) => s.conversationId);
  const callId = useRealtimeScope((s) => s.callId);
  const client = useMemo(() => {
    if (!url) return null;
    return new RealtimeClient({
      url,
      getToken: fetchRealtimeToken,
    });
  }, [url, conversationId, callId]);

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
