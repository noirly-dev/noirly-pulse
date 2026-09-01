"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { IncomingCallModal } from "@/src/features/calls/IncomingCallModal";
import { CallOverlay } from "@/src/features/calls/CallOverlay";
import { CallPiP } from "@/src/features/calls/CallPiP";
import { CallSignaling } from "@/src/features/calls/CallSignaling";
import { PermissionDeniedCard } from "@/src/features/calls/PermissionDeniedCard";
import { useCallStore } from "@/src/stores/call-store";

export function CallMediaProvider({
  userId,
  displayName,
  avatarUrl,
  children,
}: {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  children?: ReactNode;
}) {
  const hydrateFromLink = useCallStore((s) => s.hydrateFromLink);
  const callId = useCallStore((s) => s.callId);
  const status = useCallStore((s) => s.status);
  const conversationId = useCallStore((s) => s.conversationId);
  const layout = useCallStore((s) => s.layout);
  const setLayout = useCallStore((s) => s.setLayout);
  const permissionError = useCallStore((s) => s.permissionError);
  const clearPermissionError = useCallStore((s) => s.clearPermissionError);
  const pathname = usePathname();
  const realtimeEnabled = Boolean(process.env.NEXT_PUBLIC_REALTIME_WS_URL);

  const live =
    status === "ringing-out" ||
    status === "connecting" ||
    status === "active" ||
    status === "reconnecting";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedCall = params.get("call");
    if (linkedCall) void hydrateFromLink(linkedCall, userId);
  }, [hydrateFromLink, userId]);

  useEffect(() => {
    if (!live || !conversationId) return;
    if (pathname.includes(conversationId)) setLayout("overlay");
    else setLayout("pip");
  }, [live, conversationId, pathname, setLayout]);

  useEffect(() => {
    function onDeviceChange() {
      const selected = useCallStore.getState().local.deviceIdMic;
      if (!selected) return;
      void navigator.mediaDevices.enumerateDevices().then((devices) => {
        const stillThere = devices.some((device) => device.deviceId === selected);
        if (!stillThere) {
          useCallStore.setState((state) => ({
            local: { ...state.local, deviceIdMic: null },
          }));
        }
      });
    }
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
  }, []);

  return (
    <>
      {children}
      {realtimeEnabled && callId ? (
        <CallSignaling
          userId={userId}
          callId={callId}
          displayName={displayName}
          avatarUrl={avatarUrl}
        />
      ) : null}
      <IncomingCallModal userId={userId} />
      <CallOverlay />
      {layout === "pip" ? <CallPiP /> : null}
      {permissionError && status === "idle" ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-call-canvas/70 p-4">
          <PermissionDeniedCard
            kind={permissionError.kind}
            message={permissionError.message}
            onDismiss={clearPermissionError}
          />
        </div>
      ) : null}
    </>
  );
}
