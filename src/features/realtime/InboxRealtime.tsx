"use client";

import {
  useChannel,
  useRealtimeClient,
  useRealtimeStatus,
} from "@noirly-dev/realtime-client/react";
import { useEffect } from "react";
import { pulseChannel } from "@/src/core/realtime/channels";
import { ConnectionBanner } from "@/src/features/realtime/ConnectionBanner";

export function InboxRealtime({ userId }: { userId: string }) {
  const client = useRealtimeClient();
  const status = useRealtimeStatus();
  useChannel(pulseChannel.inbox(userId), { replayLimit: 20 });

  useEffect(() => {
    void client.connect();
  }, [client]);

  if (status === "reconnecting" || status === "closed") {
    return <ConnectionBanner status={status} />;
  }
  return null;
}
