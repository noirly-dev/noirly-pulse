"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { conversationHref } from "@/src/core/calls/href";
import { getMediaSession } from "@/src/features/calls/media-session";
import { useCallStore } from "@/src/stores/call-store";

export function CallPiP() {
  const layout = useCallStore((s) => s.layout);
  const status = useCallStore((s) => s.status);
  const conversationId = useCallStore((s) => s.conversationId);
  const workspaceId = useCallStore((s) => s.workspaceId);
  const conversationKind = useCallStore((s) => s.conversationKind);
  const callId = useCallStore((s) => s.callId);
  const currentUserId = useCallStore((s) => s.currentUserId);
  const presenterUserId = useCallStore((s) => s.presenterUserId);
  const activeSpeakerUserId = useCallStore((s) => s.activeSpeakerUserId);
  const peerUserId = useCallStore((s) => s.peerUserId);
  const mediaGeneration = useCallStore((s) => s.mediaGeneration);
  const setLayout = useCallStore((s) => s.setLayout);
  const videoRef = useRef<HTMLVideoElement>(null);

  const live =
    status === "ringing-out" ||
    status === "connecting" ||
    status === "active" ||
    status === "reconnecting";

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const session = getMediaSession();
    let stream: MediaStream | null = null;
    if (presenterUserId) {
      stream =
        presenterUserId === currentUserId
          ? session?.screenStream ?? session?.localStream ?? null
          : session?.screenStreams.get(presenterUserId) ??
            session?.remoteStreams.get(presenterUserId) ??
            null;
    }
    if (!stream && activeSpeakerUserId) {
      stream =
        activeSpeakerUserId === currentUserId
          ? session?.localStream ?? null
          : session?.remoteStreams.get(activeSpeakerUserId) ?? null;
    }
    if (!stream) {
      stream =
        (peerUserId ? session?.remoteStreams.get(peerUserId) : null) ??
        session?.remoteStream ??
        session?.localStream ??
        null;
    }
    if (stream && el.srcObject !== stream) el.srcObject = stream;
  }, [activeSpeakerUserId, currentUserId, mediaGeneration, peerUserId, presenterUserId]);

  if (layout !== "pip" || !live) return null;

  const href = conversationId
    ? conversationHref({
        conversationId,
        workspaceId,
        conversationKind,
        callId,
      })
    : null;

  return (
    <div className="fixed right-4 bottom-4 z-[60] h-[158px] w-[280px] overflow-hidden border border-dashed border-white/20 bg-call-canvas text-call-ink shadow-lg">
      <button
        type="button"
        className="relative block h-full w-full"
        onClick={() => setLayout("overlay")}
        aria-label="Expand call"
      >
        <video ref={videoRef} className="h-full w-full bg-black object-cover" autoPlay playsInline muted />
      </button>
      {href ? (
        <Link
          href={href}
          className="absolute bottom-1 left-1 bg-black/55 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white"
        >
          Go to conversation
        </Link>
      ) : null}
    </div>
  );
}
