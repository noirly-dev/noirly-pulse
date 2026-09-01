import type { types as MediasoupTypes } from "mediasoup-client";
import type { IceServer } from "@/src/core/calls/ice";
import type { IceBatcher } from "@/src/core/calls/ice-batch";
import type { TrackSource } from "@/src/core/calls/protocol";
import { stopStream } from "@/src/features/calls/permissions";

export type MediaPath = "p2p" | "sfu";

export type MediaSession = {
  callId: string;
  localUserId: string;
  remoteUserId: string;
  path: MediaPath | null;
  pc: RTCPeerConnection | null;
  device: MediasoupTypes.Device | null;
  sendTransport: MediasoupTypes.Transport | null;
  recvTransport: MediasoupTypes.Transport | null;
  producers: Map<TrackSource, MediasoupTypes.Producer>;
  consumers: Map<string, MediasoupTypes.Consumer>;
  remoteStreams: Map<string, MediaStream>;
  screenStreams: Map<string, MediaStream>;
  screenStream: MediaStream | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  iceServers: IceServer[];
  iceBatcher: IceBatcher | null;
  pendingRemoteCandidates: RTCIceCandidateInit[];
  statsTimer: ReturnType<typeof setInterval> | null;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
  failTimer: ReturnType<typeof setTimeout> | null;
  speakingTimer: ReturnType<typeof setInterval> | null;
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  seq: number;
  makingOffer: boolean;
  ignoreOffer: boolean;
  connectedPosted: boolean;
  remoteDescriptionSet: boolean;
  pendingOffer: { event: string; sdp: string } | null;
};

let session: MediaSession | null = null;

export function getMediaSession(): MediaSession | null {
  return session;
}

export function replaceMediaSession(next: MediaSession | null): void {
  session = next;
}

function emptySfuMaps(): Pick<
  MediaSession,
  "producers" | "consumers" | "remoteStreams" | "screenStreams"
> {
  return {
    producers: new Map(),
    consumers: new Map(),
    remoteStreams: new Map(),
    screenStreams: new Map(),
  };
}

export function ensureMediaSession(
  partial: Pick<MediaSession, "callId" | "localUserId" | "remoteUserId">,
): MediaSession {
  if (session && session.callId === partial.callId) {
    session.localUserId = partial.localUserId;
    session.remoteUserId = partial.remoteUserId;
    return session;
  }
  closeCallMedia();
  session = {
    callId: partial.callId,
    localUserId: partial.localUserId,
    remoteUserId: partial.remoteUserId,
    path: null,
    pc: null,
    device: null,
    sendTransport: null,
    recvTransport: null,
    ...emptySfuMaps(),
    screenStream: null,
    localStream: null,
    remoteStream: null,
    iceServers: [],
    iceBatcher: null,
    pendingRemoteCandidates: [],
    statsTimer: null,
    disconnectTimer: null,
    failTimer: null,
    speakingTimer: null,
    audioContext: null,
    analyser: null,
    seq: 0,
    makingOffer: false,
    ignoreOffer: false,
    connectedPosted: false,
    remoteDescriptionSet: false,
    pendingOffer: null,
  };
  return session;
}

/** Close the P2P peer connection only — keep localStream for P2P→SFU migration. */
export function closePeerConnection(): void {
  if (!session) return;
  session.iceBatcher?.dispose();
  session.iceBatcher = null;
  if (session.statsTimer) clearInterval(session.statsTimer);
  if (session.disconnectTimer) clearTimeout(session.disconnectTimer);
  if (session.failTimer) clearTimeout(session.failTimer);
  if (session.speakingTimer) clearInterval(session.speakingTimer);
  session.statsTimer = null;
  session.disconnectTimer = null;
  session.failTimer = null;
  session.speakingTimer = null;
  try {
    session.pc?.close();
  } catch {
    // already closed
  }
  session.pc = null;
  if (session.path === "p2p") session.path = null;
}

export function closeSfuMedia(): void {
  if (!session) return;
  for (const producer of session.producers.values()) {
    try {
      producer.close();
    } catch {
      // already closed
    }
  }
  session.producers.clear();
  for (const consumer of session.consumers.values()) {
    try {
      consumer.close();
    } catch {
      // already closed
    }
  }
  session.consumers.clear();
  try {
    session.sendTransport?.close();
  } catch {
    // already closed
  }
  try {
    session.recvTransport?.close();
  } catch {
    // already closed
  }
  session.sendTransport = null;
  session.recvTransport = null;
  session.device = null;
  stopStream(session.screenStream);
  session.screenStream = null;
  for (const stream of session.remoteStreams.values()) stopStream(stream);
  for (const stream of session.screenStreams.values()) stopStream(stream);
  session.remoteStreams.clear();
  session.screenStreams.clear();
  if (session.path === "sfu") session.path = null;
}

export function closeCallMedia(): void {
  if (!session) return;
  closeSfuMedia();
  closePeerConnection();
  stopStream(session.localStream);
  stopStream(session.remoteStream);
  void session.audioContext?.close().catch(() => undefined);
  session = null;
}

export function nextSignalSeq(): number {
  if (!session) return 1;
  session.seq += 1;
  return session.seq;
}
