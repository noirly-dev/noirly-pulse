"use client";

import { useEffect, useRef, useState } from "react";
import { callMediaLabel } from "@/src/core/calls/copy";
import { Button } from "@noirly-dev/ui";
import { LiveRegion } from "@/src/components/LiveRegion";
import { useCallStore } from "@/src/stores/call-store";
import { CallControls } from "@/src/features/calls/CallControls";
import { CallReconnectBanner } from "@/src/features/calls/CallReconnectBanner";
import { CallTimer } from "@/src/features/calls/CallTimer";
import { ConnectionQualityChip } from "@/src/features/calls/ConnectionQualityChip";
import { ParticipantGrid } from "@/src/features/calls/ParticipantGrid";
import { ParticipantTile } from "@/src/features/calls/ParticipantTile";
import { PermissionDeniedCard } from "@/src/features/calls/PermissionDeniedCard";
import { ReactionBurst } from "@/src/features/calls/ReactionBurst";

function statusCopy(status: string, peerName: string, type: "audio" | "video") {
  if (status === "requesting-media") return "Waiting for microphone permission…";
  if (status === "ringing-out") return `Calling ${peerName}…`;
  if (status === "connecting") return `Connecting to ${peerName}…`;
  if (status === "reconnecting") return "Reconnecting";
  if (status === "active") return `Connected · ${callMediaLabel(type)}`;
  if (status === "ending") return "Ending call…";
  return peerName;
}

export function CallOverlay() {
  const status = useCallStore((s) => s.status);
  const layout = useCallStore((s) => s.layout);
  const peerName = useCallStore((s) => s.peerName);
  const peerAvatarUrl = useCallStore((s) => s.peerAvatarUrl);
  const type = useCallStore((s) => s.type);
  const startedAt = useCallStore((s) => s.startedAt);
  const quality = useCallStore((s) => s.quality);
  const local = useCallStore((s) => s.local);
  const peerMuted = useCallStore((s) => s.peerMuted);
  const peerVideoOn = useCallStore((s) => s.peerVideoOn);
  const peerSpeaking = useCallStore((s) => s.peerSpeaking);
  const mediaGeneration = useCallStore((s) => s.mediaGeneration);
  const permissionError = useCallStore((s) => s.permissionError);
  const mediaPath = useCallStore((s) => s.mediaPath);
  const peers = useCallStore((s) => s.peers);
  const presentQueue = useCallStore((s) => s.presentQueue);
  const moderator = useCallStore((s) => s.moderator);
  const presenterUserId = useCallStore((s) => s.presenterUserId);
  const currentUserId = useCallStore((s) => s.currentUserId);
  const reactions = useCallStore((s) => s.reactions);
  const expireIfNeeded = useCallStore((s) => s.expireIfNeeded);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const toggleCamera = useCallStore((s) => s.toggleCamera);
  const toggleHand = useCallStore((s) => s.toggleHand);
  const startPresent = useCallStore((s) => s.startPresent);
  const stopPresent = useCallStore((s) => s.stopPresent);
  const endCall = useCallStore((s) => s.endCall);
  const leaveCall = useCallStore((s) => s.leaveCall);
  const grantPresent = useCallStore((s) => s.grantPresent);
  const dismissPresentRequest = useCallStore((s) => s.dismissPresentRequest);
  const setLayout = useCallStore((s) => s.setLayout);
  const clearPermissionError = useCallStore((s) => s.clearPermissionError);
  const [now, setNow] = useState(Date.now());
  const [barVisible, setBarVisible] = useState(true);
  const [liveMessage, setLiveMessage] = useState("");
  const hideTimer = useRef<number | null>(null);

  const visible =
    status === "requesting-media" ||
    status === "ringing-out" ||
    status === "connecting" ||
    status === "active" ||
    status === "reconnecting" ||
    status === "ending";

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      void expireIfNeeded();
    }, 1000);
    return () => window.clearInterval(id);
  }, [visible, expireIfNeeded]);

  useEffect(() => {
    if (status === "active") setLiveMessage("Connected");
    else if (status === "reconnecting") setLiveMessage("Reconnecting");
  }, [status]);

  useEffect(() => {
    if (peerMuted) setLiveMessage(`${peerName || "Someone"} muted`);
  }, [peerMuted, peerName]);

  useEffect(() => {
    if (!visible || layout === "pip") return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        toggleMute();
      }
      if ((event.key === "v" || event.key === "V") && type === "video") {
        event.preventDefault();
        void toggleCamera();
      }
      if (event.shiftKey && (event.key === "e" || event.key === "E")) {
        event.preventDefault();
        if (mediaPath === "sfu") void leaveCall();
        else void endCall();
      }
      if (event.shiftKey && (event.key === "s" || event.key === "S")) {
        event.preventDefault();
        if (local.isPresenting) void stopPresent();
        else void startPresent();
      }
      if (event.key === "h" || event.key === "H") {
        event.preventDefault();
        toggleHand();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    visible,
    layout,
    toggleMute,
    toggleCamera,
    toggleHand,
    startPresent,
    stopPresent,
    endCall,
    leaveCall,
    type,
    mediaPath,
    local.isPresenting,
  ]);

  function showBar() {
    setBarVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setBarVisible(false), 2500);
  }

  useEffect(() => {
    if (!visible) return;
    showBar();
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [visible]);

  if (layout === "pip") return null;
  if (!visible || !type) return null;

  const heading = statusCopy(status, peerName, type);
  const reconnecting = status === "reconnecting";
  const useGrid = mediaPath === "sfu" || Object.keys(peers).length > 0;
  const requesterId = presentQueue[0];
  const requester = requesterId ? peers[requesterId] : null;
  const canGrant =
    Boolean(requesterId) &&
    requesterId !== currentUserId &&
    (moderator || presenterUserId === currentUserId);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-call-canvas text-call-ink"
      onPointerMove={showBar}
      data-call-hotkeys
    >
      <LiveRegion message={liveMessage || heading} />
      {reconnecting ? <CallReconnectBanner /> : null}
      <header className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-call-accent">
            {type === "video" ? "Video" : "Voice"}
          </p>
          <h1 className="font-display text-xl font-bold uppercase tracking-[-0.04em]">{peerName || "Call"}</h1>
        </div>
        <div className="flex items-center gap-4">
          {startedAt && (status === "active" || status === "reconnecting") ? (
            <CallTimer startedAt={startedAt} now={now} />
          ) : (
            <p className="text-sm text-white/55">{heading}</p>
          )}
          <ConnectionQualityChip quality={quality} />
          <button
            type="button"
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/55 hover:text-white"
            onClick={() => setLayout("pip")}
          >
            Minimize
          </button>
        </div>
      </header>
      {canGrant && requesterId ? (
        <div className="mx-4 mb-2 flex items-center justify-between gap-3 border border-dashed border-white/20 bg-call-elevated px-3 py-2 text-sm">
          <p>{requester?.displayName ?? "Someone"} wants to present</p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="h-8 border-white/25 px-3 text-xs text-call-ink hover:bg-white hover:text-call-canvas"
              onClick={() => dismissPresentRequest()}
            >
              Dismiss
            </Button>
            <Button
              className="h-8 bg-call-accent px-3 text-xs text-call-accent-fg hover:opacity-90"
              onClick={() => void grantPresent(requesterId)}
            >
              Accept
            </Button>
          </div>
        </div>
      ) : null}
      {useGrid ? (
        <ParticipantGrid />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-4 md:grid-cols-2">
          <ParticipantTile
            name={peerName}
            avatarUrl={peerAvatarUrl}
            videoOn={type === "video" && peerVideoOn}
            muted={peerMuted}
            speaking={peerSpeaking && !peerMuted}
            mediaGeneration={mediaGeneration}
          />
          <ParticipantTile
            name="You"
            avatarUrl={null}
            local
            videoOn={type === "video" && local.isVideoOn}
            muted={local.isMuted}
            speaking={false}
            mediaGeneration={mediaGeneration}
          />
        </div>
      )}
      <ReactionBurst reactions={reactions} />
      {permissionError ? (
        <div className="flex justify-center px-4 pb-4">
          <PermissionDeniedCard
            kind={permissionError.kind}
            message={permissionError.message}
            onDismiss={clearPermissionError}
          />
        </div>
      ) : null}
      <div
        className={`border-t border-white/10 bg-call-elevated px-4 py-4 transition-opacity ${
          barVisible
            ? "opacity-100"
            : "pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100"
        }`}
      >
        <CallControls />
      </div>
    </div>
  );
}
