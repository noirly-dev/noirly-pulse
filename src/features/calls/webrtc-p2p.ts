import { createIceBatcher } from "@/src/core/calls/ice-batch";
import type { IceServer } from "@/src/core/calls/ice";
import { politePeer } from "@/src/core/calls/polite";
import { qualityFromRtcStats, summarizeInboundStats, type ConnectionQuality } from "@/src/core/calls/stats";
import {
  getMediaSession,
  type MediaSession,
} from "@/src/features/calls/media-session";

export type P2PSignalEvent =
  | "webrtc.offer"
  | "webrtc.answer"
  | "webrtc.ice-batch"
  | "webrtc.ice-complete"
  | "webrtc.ice-restart-offer";

export type P2PSend = (event: P2PSignalEvent, data: Record<string, unknown>) => void;

export type P2PCallbacks = {
  send: P2PSend;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionState: (state: "connecting" | "connected" | "reconnecting" | "failed") => void;
  onQuality: (quality: ConnectionQuality) => void;
  onSpeaking: (speaking: boolean) => void;
};

const DISCONNECT_RESTART_MS = 8_000;
const GIVE_UP_MS = 20_000;

async function flushPending(session: MediaSession) {
  if (!session.pc || !session.remoteDescriptionSet) return;
  const queued = session.pendingRemoteCandidates;
  session.pendingRemoteCandidates = [];
  for (const candidate of queued) {
    try {
      await session.pc.addIceCandidate(candidate);
    } catch {
      // stale candidate
    }
  }
}

function startSpeakingProbe(session: MediaSession, onSpeaking: (speaking: boolean) => void) {
  const stream = session.remoteStream;
  if (!stream) return;
  const audioTrack = stream.getAudioTracks()[0];
  if (!audioTrack) return;
  if (session.speakingTimer) clearInterval(session.speakingTimer);
  try {
    const context = session.audioContext ?? new AudioContext();
    session.audioContext = context;
    const source = context.createMediaStreamSource(new MediaStream([audioTrack]));
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    session.analyser = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    session.speakingTimer = setInterval(() => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, value) => sum + value, 0) / data.length;
      onSpeaking(avg > 18);
    }, 200);
  } catch {
    // AudioContext may be blocked until a gesture; ignore.
  }
}

function startStats(session: MediaSession, onQuality: (quality: ConnectionQuality) => void) {
  if (session.statsTimer) clearInterval(session.statsTimer);
  session.statsTimer = setInterval(() => {
    const pc = session.pc;
    if (!pc) return;
    void pc.getStats().then((report) => {
      const rows = [...report.values()] as Array<{
        type: string;
        kind?: string;
        packetsLost?: number;
        packetsReceived?: number;
        jitter?: number;
        currentRoundTripTime?: number;
        state?: string;
        nominated?: boolean;
      }>;
      onQuality(qualityFromRtcStats(summarizeInboundStats(rows)));
    });
  }, 2_000);
}

export async function startPeerConnection(opts: {
  iceServers: IceServer[];
  callbacks: P2PCallbacks;
}): Promise<void> {
  const session = getMediaSession();
  if (!session?.localStream) throw new Error("Local media is not ready");
  if (session.pc) return;

  const pc = new RTCPeerConnection({
    iceServers: opts.iceServers,
    bundlePolicy: "max-bundle",
    iceCandidatePoolSize: 2,
  });
  session.pc = pc;
  session.path = "p2p";
  session.iceServers = opts.iceServers;
  session.makingOffer = false;
  session.ignoreOffer = false;
  session.connectedPosted = false;
  session.remoteDescriptionSet = false;
  session.pendingRemoteCandidates = [];

  for (const track of session.localStream.getTracks()) {
    pc.addTrack(track, session.localStream);
  }
  if (!session.localStream.getVideoTracks().length) {
    pc.addTransceiver("video", { direction: "recvonly" });
  }

  session.iceBatcher = createIceBatcher({
    onBatch: (candidates) => opts.callbacks.send("webrtc.ice-batch", { candidates }),
    onComplete: () => opts.callbacks.send("webrtc.ice-complete", {}),
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      session.iceBatcher?.add(event.candidate.toJSON());
    } else {
      session.iceBatcher?.complete();
    }
  };

  pc.ontrack = (event) => {
    const stream = event.streams[0] ?? new MediaStream([event.track]);
    session.remoteStream = stream;
    opts.callbacks.onRemoteStream(stream);
    startSpeakingProbe(session, opts.callbacks.onSpeaking);
  };

  pc.onnegotiationneeded = () => {
    void (async () => {
      if (pc.signalingState !== "stable") return;
      try {
        session.makingOffer = true;
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        const sdp = pc.localDescription?.sdp;
        if (sdp) opts.callbacks.send("webrtc.offer", { sdp, mediaPath: "p2p" });
      } catch {
        // glare or closed PC
      } finally {
        session.makingOffer = false;
      }
    })();
  };

  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === "connected") {
      if (session.disconnectTimer) clearTimeout(session.disconnectTimer);
      if (session.failTimer) clearTimeout(session.failTimer);
      session.disconnectTimer = null;
      session.failTimer = null;
      startStats(session, opts.callbacks.onQuality);
      opts.callbacks.onConnectionState("connected");
    } else if (state === "connecting") {
      opts.callbacks.onConnectionState("connecting");
    } else if (state === "disconnected") {
      opts.callbacks.onConnectionState("reconnecting");
      if (!session.disconnectTimer) {
        session.disconnectTimer = setTimeout(() => {
          session.disconnectTimer = null;
          try {
            pc.restartIce();
          } catch {
            opts.callbacks.onConnectionState("failed");
          }
        }, DISCONNECT_RESTART_MS);
      }
      if (!session.failTimer) {
        session.failTimer = setTimeout(() => {
          session.failTimer = null;
          opts.callbacks.onConnectionState("failed");
        }, GIVE_UP_MS);
      }
    } else if (state === "failed") {
      opts.callbacks.onConnectionState("reconnecting");
      try {
        pc.restartIce();
      } catch {
        opts.callbacks.onConnectionState("failed");
      }
      if (!session.failTimer) {
        session.failTimer = setTimeout(() => {
          session.failTimer = null;
          opts.callbacks.onConnectionState("failed");
        }, GIVE_UP_MS);
      }
    }
  };
  if (session.pendingOffer) {
    const queued = session.pendingOffer;
    session.pendingOffer = null;
    await handleP2PSignal(queued.event, { sdp: queued.sdp }, opts.callbacks.send);
  }
}

export async function handleP2PSignal(
  event: string,
  data: { sdp?: string; candidates?: RTCIceCandidateInit[]; fromUserId?: string },
  send: P2PSend,
): Promise<void> {
  const session = getMediaSession();
  if (!session) return;
  const pc = session.pc;
  if (!pc) {
    if ((event === "webrtc.offer" || event === "webrtc.ice-restart-offer") && data.sdp) {
      session.pendingOffer = { event, sdp: data.sdp };
    }
    if (event === "webrtc.ice-batch") {
      session.pendingRemoteCandidates.push(...(data.candidates ?? []));
    }
    return;
  }
  const polite = politePeer(session.localUserId, session.remoteUserId);

  try {
    if (event === "webrtc.offer" || event === "webrtc.ice-restart-offer") {
      if (!data.sdp) return;
      const offerCollision = session.makingOffer || pc.signalingState !== "stable";
      session.ignoreOffer = !polite && offerCollision;
      if (session.ignoreOffer) return;
      await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
      session.remoteDescriptionSet = true;
      await flushPending(session);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const sdp = pc.localDescription?.sdp;
      if (sdp) send("webrtc.answer", { sdp });
      return;
    }

    if (event === "webrtc.answer") {
      if (!data.sdp) return;
      if (pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
      session.remoteDescriptionSet = true;
      await flushPending(session);
      return;
    }

    if (event === "webrtc.ice-batch") {
      for (const candidate of data.candidates ?? []) {
        if (!session.remoteDescriptionSet) {
          session.pendingRemoteCandidates.push(candidate);
        } else {
          try {
            await pc.addIceCandidate(candidate);
          } catch {
            // ignore
          }
        }
      }
    }
  } catch {
    // stale description or closed PC
  }
}

export async function replaceSenderTrack(kind: "audio" | "video", track: MediaStreamTrack | null): Promise<void> {
  const pc = getMediaSession()?.pc;
  const sender = pc?.getSenders().find((entry) => entry.track?.kind === kind);
  if (sender) await sender.replaceTrack(track);
}

export function setLocalTrackEnabled(kind: "audio" | "video", enabled: boolean): void {
  const stream = getMediaSession()?.localStream;
  stream?.getTracks().forEach((track) => {
    if (track.kind === kind) track.enabled = enabled;
  });
}
