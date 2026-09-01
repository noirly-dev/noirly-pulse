import { create } from "zustand";
import { clientNonce } from "@/src/core/chat/title";
import { DEFAULT_RING_TIMEOUT_MS } from "@/src/core/calls/constants";
import type {
  InboxCallInviteData,
  ModerationMuteData,
  PresenterChangedData,
  ReactionData,
  RaiseHandData,
  SfuActiveSpeakerData,
  SfuNewProducerData,
  SfuProducerClosedData,
  TrackSource,
} from "@/src/core/calls/protocol";
import type { ConnectionQuality } from "@/src/core/calls/stats";
import type { CallPublic } from "@/src/core/models/types";
import type { CallType, ConversationKind } from "@/src/core/models/enums";
import { publishCallEvent } from "@/src/features/calls/call-publish";
import {
  closeCallMedia,
  closePeerConnection,
  ensureMediaSession,
  getMediaSession,
} from "@/src/features/calls/media-session";
import {
  acquireLocalStream,
  classifyMediaError,
  loadStoredDevices,
  saveStoredDevices,
  stopStream,
  usableDeviceId,
  type MediaErrorInfo,
  type PermissionErrorKind,
} from "@/src/features/calls/permissions";
import { setRealtimeCallId } from "@/src/features/realtime/PulseRealtimeProvider";
import { replaceSenderTrack, setLocalTrackEnabled } from "@/src/features/calls/webrtc-p2p";
import {
  closeConsumer,
  pauseProducer,
  produceScreen,
  replaceSfuTrack,
  resumeProducer,
  startSfuSession,
  stopScreen,
  type SfuCallbacks,
} from "@/src/features/calls/webrtc-sfu";
import { api } from "@/src/lib/api-client";

export type CallUiStatus =
  | "idle"
  | "requesting-media"
  | "ringing-out"
  | "ringing-in"
  | "connecting"
  | "active"
  | "reconnecting"
  | "ending";

export type CallLayoutMode = "overlay" | "pip";
export type MediaPath = "p2p" | "sfu";

export type IncomingInvite = InboxCallInviteData & { ringDeadline: number };

export type CallPeerState = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isVideoOn: boolean;
  isPresenting: boolean;
  handRaised: boolean;
  speaking: boolean;
  joined: boolean;
};

export type CallReaction = {
  id: string;
  userId: string;
  emoji: string;
  expiresAt: number;
};

type LocalMediaState = {
  isMuted: boolean;
  isVideoOn: boolean;
  isPresenting: boolean;
  handRaised: boolean;
  deviceIdMic: string | null;
  deviceIdCam: string | null;
  deviceIdOut: string | null;
  facingMode: "user" | "environment";
};

type CallStore = {
  status: CallUiStatus;
  callId: string | null;
  conversationId: string | null;
  workspaceId: string | null;
  conversationKind: ConversationKind | null;
  type: CallType | null;
  mediaPath: MediaPath | null;
  layout: CallLayoutMode;
  peerName: string;
  peerUserId: string | null;
  peerAvatarUrl: string | null;
  startedAt: number | null;
  incoming: IncomingInvite | null;
  error: string | null;
  permissionError: MediaErrorInfo | null;
  local: LocalMediaState;
  peerMuted: boolean;
  peerVideoOn: boolean;
  peerSpeaking: boolean;
  quality: ConnectionQuality;
  mediaGeneration: number;
  peers: Record<string, CallPeerState>;
  activeSpeakerUserId: string | null;
  presenterUserId: string | null;
  presentQueue: string[];
  reactions: CallReaction[];
  moderator: boolean;
  initiatedBy: string | null;
  currentUserId: string | null;
  startCall: (input: {
    conversationId: string;
    type: CallType;
    peerName: string;
    peerUserId?: string | null;
    peerAvatarUrl?: string | null;
    currentUserId: string;
    conversationKind?: ConversationKind | null;
    canModerate?: boolean;
    workspaceId?: string | null;
  }) => Promise<void>;
  acceptIncoming: (currentUserId: string) => Promise<void>;
  declineIncoming: () => Promise<void>;
  joinCall: (input: {
    callId: string;
    currentUserId: string;
    canModerate?: boolean;
    conversationKind?: ConversationKind | null;
  }) => Promise<void>;
  leaveCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
  cycleCamera: () => Promise<void>;
  selectDevice: (kind: "mic" | "cam" | "out", deviceId: string) => Promise<void>;
  startPresent: () => Promise<void>;
  stopPresent: () => Promise<void>;
  grantPresent: (userId: string) => Promise<void>;
  dismissPresentRequest: () => void;
  toggleHand: () => void;
  sendReaction: (emoji: string) => void;
  muteOther: (userId: string) => Promise<void>;
  setLayout: (layout: CallLayoutMode) => void;
  receiveInvite: (invite: InboxCallInviteData) => void;
  applyRemoteAccepted: (callId: string) => void;
  applyRemoteEnded: (callId: string) => void;
  applyPeerMute: (isMuted: boolean, isVideoOn: boolean, fromUserId?: string) => void;
  applyPeerSpeaking: (speaking: boolean) => void;
  applyQuality: (quality: ConnectionQuality) => void;
  applyConnectionState: (state: "connecting" | "connected" | "reconnecting" | "failed") => void;
  applySfuProducer: (data: SfuNewProducerData) => void;
  applySfuProducerClosed: (data: SfuProducerClosedData) => void;
  applyActiveSpeaker: (data: SfuActiveSpeakerData) => void;
  applyPathChanged: () => void;
  applyPresenterChanged: (data: PresenterChangedData) => void;
  applyModerationMute: (data: ModerationMuteData) => void;
  applyRaiseHand: (data: RaiseHandData) => void;
  applyReaction: (data: ReactionData) => void;
  applyPresentRequest: (userId: string) => void;
  applyPresentRelease: (userId: string) => void;
  hydratePeersFromCall: (call: CallPublic, currentUserId: string) => void;
  bumpMedia: () => void;
  hydrateFromLink: (callId: string, currentUserId: string) => Promise<void>;
  expireIfNeeded: () => Promise<void>;
  clearPermissionError: () => void;
  reset: () => void;
};

const defaultLocal = (): LocalMediaState => {
  const stored = loadStoredDevices();
  return {
    isMuted: false,
    isVideoOn: false,
    isPresenting: false,
    handRaised: false,
    deviceIdMic: stored.mic ?? null,
    deviceIdCam: stored.cam ?? null,
    deviceIdOut: stored.out ?? null,
    facingMode: "user",
  };
};

const idle = {
  status: "idle" as const,
  callId: null,
  conversationId: null,
  workspaceId: null,
  conversationKind: null as ConversationKind | null,
  type: null,
  mediaPath: null as MediaPath | null,
  layout: "overlay" as const,
  peerName: "",
  peerUserId: null,
  peerAvatarUrl: null,
  startedAt: null,
  incoming: null,
  error: null,
  permissionError: null,
  local: defaultLocal(),
  peerMuted: false,
  peerVideoOn: false,
  peerSpeaking: false,
  quality: "unknown" as const,
  mediaGeneration: 0,
  peers: {} as Record<string, CallPeerState>,
  activeSpeakerUserId: null,
  presenterUserId: null,
  presentQueue: [] as string[],
  reactions: [] as CallReaction[],
  moderator: false,
  initiatedBy: null,
  currentUserId: null,
};

function tearDown() {
  closeCallMedia();
  setRealtimeCallId(null);
}

function sfuCallbacks(): SfuCallbacks {
  return {
    onRemoteStream: () => useCallStore.getState().bumpMedia(),
    onConnectionState: (state) => useCallStore.getState().applyConnectionState(state),
  };
}

export function peersFromCall(call: CallPublic, currentUserId: string): Record<string, CallPeerState> {
  const peers: Record<string, CallPeerState> = {};
  for (const row of call.participants) {
    if (row.userId === currentUserId) continue;
    if (!row.joinedAt || row.leftAt) continue;
    peers[row.userId] = {
      userId: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      isMuted: row.isMuted,
      isVideoOn: row.isVideoOn,
      isPresenting: row.isPresenting,
      handRaised: row.handRaised,
      speaking: false,
      joined: true,
    };
  }
  return peers;
}

function bindCall(call: CallPublic, currentUserId: string, extra: Partial<CallStore> = {}) {
  const peer = call.participants.find((row) => row.userId !== currentUserId);
  setRealtimeCallId(call.id);
  return {
    callId: call.id,
    conversationId: call.conversationId,
    workspaceId: call.workspaceId,
    conversationKind:
      extra.conversationKind ?? (call.workspaceId ? ("channel" as const) : ("dm" as const)),
    type: call.type,
    peerUserId: peer?.userId ?? extra.peerUserId ?? null,
    peerName: extra.peerName ?? peer?.displayName ?? "Someone",
    peerAvatarUrl: extra.peerAvatarUrl ?? peer?.avatarUrl ?? null,
    mediaPath: call.mediaPath,
    initiatedBy: call.initiatedBy,
    presenterUserId: call.presenterUserId,
    currentUserId,
    moderator: call.initiatedBy === currentUserId || extra.moderator === true,
    peers: peersFromCall(call, currentUserId),
  };
}

function attachLocalStream(callId: string, currentUserId: string, remoteUserId: string, stream: MediaStream) {
  const session = ensureMediaSession({
    callId,
    localUserId: currentUserId,
    remoteUserId,
  });
  stopStream(session.localStream);
  session.localStream = stream;
}

function patchPeer(
  peers: Record<string, CallPeerState>,
  userId: string,
  patch: Partial<CallPeerState>,
): Record<string, CallPeerState> {
  const existing = peers[userId] ?? {
    userId,
    displayName: "Someone",
    avatarUrl: null,
    isMuted: false,
    isVideoOn: false,
    isPresenting: false,
    handRaised: false,
    speaking: false,
    joined: true,
  };
  return { ...peers, [userId]: { ...existing, ...patch } };
}

async function syncSfuTrack(kind: "audio" | "video", track: MediaStreamTrack | null) {
  const path = useCallStore.getState().mediaPath;
  if (path === "sfu") {
    await replaceSfuTrack(kind === "audio" ? "mic" : "camera", track);
    return;
  }
  await replaceSenderTrack(kind, track);
}

export const useCallStore = create<CallStore>((set, get) => ({
  ...idle,

  bumpMedia() {
    set({ mediaGeneration: get().mediaGeneration + 1 });
  },

  setLayout(layout) {
    set({ layout });
  },

  hydratePeersFromCall(call, currentUserId) {
    set({
      peers: peersFromCall(call, currentUserId),
      presenterUserId: call.presenterUserId,
      mediaPath: call.mediaPath,
    });
  },

  async startCall({
    conversationId,
    type,
    peerName,
    peerUserId,
    peerAvatarUrl,
    currentUserId,
    conversationKind,
    canModerate,
    workspaceId,
  }) {
    if (get().status !== "idle") return;
    const devices = loadStoredDevices();
    set({
      error: null,
      permissionError: null,
      peerName,
      peerUserId: peerUserId ?? null,
      peerAvatarUrl: peerAvatarUrl ?? null,
      type,
      conversationId,
      conversationKind: conversationKind ?? null,
      workspaceId: workspaceId ?? null,
      currentUserId,
      status: "requesting-media",
      local: {
        ...get().local,
        deviceIdMic: devices.mic ?? null,
        deviceIdCam: devices.cam ?? null,
        deviceIdOut: devices.out ?? null,
        isMuted: false,
        isVideoOn: type === "video",
        isPresenting: false,
        handRaised: false,
      },
    });
    let stream: MediaStream | null = null;
    try {
      const acquired = await acquireLocalStream({
        video: type === "video",
        micId: devices.mic,
        camId: devices.cam,
      });
      stream = acquired.stream;
      if (get().status !== "requesting-media") {
        stopStream(stream);
        return;
      }
      const { call } = await api.createCall({
        conversationId,
        type,
        clientNonce: clientNonce(),
      });
      if (get().status !== "requesting-media") {
        stopStream(stream);
        await api.endCall(call.id).catch(() => undefined);
        return;
      }
      const peer = call.participants.find((row) => row.userId !== currentUserId);
      attachLocalStream(call.id, currentUserId, peer?.userId ?? peerUserId ?? "", acquired.stream);
      const mediaPath = call.mediaPath;
      const nextStatus =
        mediaPath === "sfu" && call.status === "connecting" ? "connecting" : "ringing-out";
      set({
        ...bindCall(call, currentUserId, {
          peerName,
          peerAvatarUrl,
          conversationKind,
          moderator: canModerate,
        }),
        status: nextStatus,
        startedAt: null,
        permissionError: acquired.permissionError,
        local: {
          ...get().local,
          isVideoOn: acquired.videoEnabled,
        },
        peerVideoOn: type === "video",
        mediaGeneration: get().mediaGeneration + 1,
      });
    } catch (error) {
      stopStream(stream);
      closeCallMedia();
      const permission = error && typeof error === "object" && "kind" in error ? (error as MediaErrorInfo) : null;
      set({
        ...idle,
        permissionError: permission,
        error: permission ? null : error instanceof Error ? error.message : "Could not start call",
      });
      setRealtimeCallId(null);
    }
  },

  receiveInvite(invite) {
    const current = get();
    if (current.status !== "idle") {
      if (current.callId === invite.callId) return;
      void api.declineCall(invite.callId).catch(() => undefined);
      return;
    }
    set({
      status: "ringing-in",
      incoming: {
        ...invite,
        ringDeadline: Date.now() + (invite.ringTimeoutMs || DEFAULT_RING_TIMEOUT_MS),
      },
      callId: invite.callId,
      conversationId: invite.conversationId,
      conversationKind: invite.conversationKind,
      workspaceId: invite.workspaceId,
      type: invite.type,
      peerName: invite.initiatedByName,
      peerUserId: invite.initiatedBy,
      peerAvatarUrl: null,
      peerVideoOn: invite.type === "video",
      initiatedBy: invite.initiatedBy,
    });
    setRealtimeCallId(invite.callId);
  },

  async acceptIncoming(currentUserId) {
    const incoming = get().incoming;
    if (!incoming) return;
    const devices = loadStoredDevices();
    set({ status: "requesting-media", error: null, permissionError: null, currentUserId });
    let stream: MediaStream | null = null;
    try {
      const acquired = await acquireLocalStream({
        video: incoming.type === "video",
        micId: devices.mic,
        camId: devices.cam,
      });
      stream = acquired.stream;
      if (get().status !== "requesting-media" || get().incoming?.callId !== incoming.callId) {
        stopStream(stream);
        return;
      }
      const { call } = await api.acceptCall(incoming.callId);
      if (get().status !== "requesting-media" || get().incoming?.callId !== incoming.callId) {
        stopStream(stream);
        await api.endCall(call.id).catch(() => undefined);
        return;
      }
      attachLocalStream(call.id, currentUserId, incoming.initiatedBy, acquired.stream);
      set({
        ...bindCall(call, currentUserId, {
          peerName: incoming.initiatedByName,
          conversationKind: incoming.conversationKind,
        }),
        status: "connecting",
        incoming: null,
        startedAt: null,
        permissionError: acquired.permissionError,
        local: {
          ...get().local,
          isMuted: false,
          isVideoOn: acquired.videoEnabled,
          deviceIdMic: devices.mic ?? null,
          deviceIdCam: devices.cam ?? null,
        },
        mediaGeneration: get().mediaGeneration + 1,
        peerVideoOn: incoming.type === "video",
      });
    } catch (error) {
      stopStream(stream);
      closeCallMedia();
      const permission = error && typeof error === "object" && "kind" in error ? (error as MediaErrorInfo) : null;
      if (permission && get().incoming?.callId === incoming.callId) {
        set({
          status: "ringing-in",
          permissionError: permission,
        });
        return;
      }
      set({
        ...idle,
        error: error instanceof Error ? error.message : "Could not accept call",
      });
      setRealtimeCallId(null);
    }
  },

  async joinCall({ callId, currentUserId, canModerate, conversationKind }) {
    if (get().status !== "idle") return;
    const devices = loadStoredDevices();
    set({ status: "requesting-media", error: null, permissionError: null, currentUserId });
    let stream: MediaStream | null = null;
    try {
      const { call: snapshot } = await api.getCall(callId);
      const acquired = await acquireLocalStream({
        video: snapshot.type === "video",
        micId: devices.mic,
        camId: devices.cam,
      });
      stream = acquired.stream;
      if (get().status !== "requesting-media") {
        stopStream(stream);
        return;
      }
      const { call } = await api.joinCall(callId);
      if (get().status !== "requesting-media") {
        stopStream(stream);
        await api.leaveCall(call.id).catch(() => undefined);
        return;
      }
      const peer = call.participants.find((row) => row.userId !== currentUserId);
      attachLocalStream(call.id, currentUserId, peer?.userId ?? "", acquired.stream);
      set({
        ...bindCall(call, currentUserId, { conversationKind, moderator: canModerate }),
        status: "connecting",
        incoming: null,
        startedAt: null,
        permissionError: acquired.permissionError,
        local: {
          ...get().local,
          isMuted: false,
          isVideoOn: acquired.videoEnabled,
          deviceIdMic: devices.mic ?? null,
          deviceIdCam: devices.cam ?? null,
          isPresenting: false,
          handRaised: false,
        },
        mediaGeneration: get().mediaGeneration + 1,
        peerVideoOn: call.type === "video",
      });
    } catch (error) {
      stopStream(stream);
      closeCallMedia();
      const permission = error && typeof error === "object" && "kind" in error ? (error as MediaErrorInfo) : null;
      set({
        ...idle,
        permissionError: permission,
        error: permission ? null : error instanceof Error ? error.message : "Could not join call",
      });
      setRealtimeCallId(null);
    }
  },

  async declineIncoming() {
    const incoming = get().incoming;
    const callId = incoming?.callId ?? get().callId;
    tearDown();
    set({ ...idle });
    if (callId) {
      await api.declineCall(callId).catch(() => undefined);
    }
  },

  async leaveCall() {
    const callId = get().callId;
    set({ status: "ending" });
    if (callId) {
      await api.leaveCall(callId).catch(() => undefined);
    }
    tearDown();
    set({ ...idle });
  },

  async endCall() {
    const callId = get().callId;
    set({ status: "ending" });
    if (callId) {
      await api.endCall(callId).catch(() => undefined);
    }
    tearDown();
    set({ ...idle });
  },

  toggleMute() {
    const next = !get().local.isMuted;
    setLocalTrackEnabled("audio", !next);
    if (get().mediaPath === "sfu") {
      if (next) pauseProducer("mic");
      else resumeProducer("mic");
    }
    set({ local: { ...get().local, isMuted: next } });
  },

  async toggleCamera() {
    const current = get();
    if (current.type !== "video") return;
    const nextOn = !current.local.isVideoOn;
    const session = getMediaSession();
    const existing = session?.localStream?.getVideoTracks()[0];
    if (existing) {
      existing.enabled = nextOn;
      if (current.mediaPath === "sfu") {
        if (nextOn) resumeProducer("camera");
        else pauseProducer("camera");
      }
      set({ local: { ...current.local, isVideoOn: nextOn } });
      return;
    }
    if (!nextOn) {
      if (current.mediaPath === "sfu") pauseProducer("camera");
      set({ local: { ...current.local, isVideoOn: false } });
      return;
    }
    try {
      const extra = await navigator.mediaDevices.getUserMedia({
        video: usableDeviceId(current.local.deviceIdCam)
          ? { deviceId: { exact: usableDeviceId(current.local.deviceIdCam) } }
          : true,
        audio: false,
      });
      const track = extra.getVideoTracks()[0];
      if (!track || !session?.localStream) return;
      session.localStream.addTrack(track);
      await syncSfuTrack("video", track);
      set({
        local: { ...get().local, isVideoOn: true },
        mediaGeneration: get().mediaGeneration + 1,
      });
    } catch (error) {
      const permission = error instanceof DOMException
        ? { kind: "camera" as PermissionErrorKind, message: error.message }
        : null;
      set({ permissionError: permission });
    }
  },

  async cycleCamera() {
    const facing = get().local.facingMode === "user" ? "environment" : "user";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: facing } },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const session = getMediaSession();
      const old = session?.localStream?.getVideoTracks()[0];
      if (old && session?.localStream) {
        session.localStream.removeTrack(old);
        old.stop();
        session.localStream.addTrack(track);
      }
      await syncSfuTrack("video", track);
      set({
        local: { ...get().local, facingMode: facing, isVideoOn: true },
        mediaGeneration: get().mediaGeneration + 1,
      });
    } catch {
      set({ error: "Could not switch camera" });
    }
  },

  async selectDevice(kind, deviceId) {
    if (!deviceId) return;
    const stored = { ...loadStoredDevices() };
    if (kind === "out") {
      stored.out = deviceId;
      saveStoredDevices(stored);
      set({ local: { ...get().local, deviceIdOut: deviceId } });
      const remote = document.getElementById("pulse-call-remote") as HTMLMediaElement | null;
      if (remote && "setSinkId" in remote) {
        await (remote as HTMLMediaElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId);
      }
      return;
    }
    const session = getMediaSession();
    if (kind === "mic") {
      stored.mic = deviceId;
      saveStoredDevices(stored);
      const constraintId = usableDeviceId(deviceId);
      const next = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(constraintId ? { deviceId: { exact: constraintId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      const track = next.getAudioTracks()[0];
      const old = session?.localStream?.getAudioTracks()[0];
      if (old && session?.localStream && track) {
        session.localStream.removeTrack(old);
        old.stop();
        session.localStream.addTrack(track);
      }
      await syncSfuTrack("audio", track ?? null);
      set({
        local: { ...get().local, deviceIdMic: deviceId, isMuted: false },
        mediaGeneration: get().mediaGeneration + 1,
      });
      return;
    }
    stored.cam = deviceId;
    saveStoredDevices(stored);
    const constraintId = usableDeviceId(deviceId);
    const next = await navigator.mediaDevices.getUserMedia({
      video: constraintId ? { deviceId: { exact: constraintId } } : true,
      audio: false,
    });
    const track = next.getVideoTracks()[0];
    const old = session?.localStream?.getVideoTracks()[0];
    if (old && session?.localStream && track) {
      session.localStream.removeTrack(old);
      old.stop();
      session.localStream.addTrack(track);
    }
    await syncSfuTrack("video", track ?? null);
    set({
      local: { ...get().local, deviceIdCam: deviceId, isVideoOn: true },
      mediaGeneration: get().mediaGeneration + 1,
    });
  },

  async startPresent() {
    const current = get();
    const callId = current.callId;
    const me = current.currentUserId;
    if (!callId || !me) return;
    try {
      if (current.mediaPath === "p2p") {
        await api.upgradeCallToSfu(callId);
        await startSfuSession({ callId, callbacks: sfuCallbacks() });
        set({ mediaPath: "sfu", status: current.status === "active" ? "connecting" : current.status });
      }
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const session = getMediaSession();
      if (!session) {
        stopStream(display);
        return;
      }
      stopStream(session.screenStream);
      session.screenStream = display;
      const track = display.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          void useCallStore.getState().stopPresent();
        };
      }
      const presenter = get().presenterUserId;
      if (presenter && presenter !== me) {
        publishCallEvent("call.present-request", {});
        const queue = get().presentQueue;
        set({
          presentQueue: queue.includes(me) ? queue : [...queue, me],
          mediaGeneration: get().mediaGeneration + 1,
        });
        return;
      }
      await api.setCallPresenter(callId, me);
      if (track) await produceScreen(track);
      set({
        local: { ...get().local, isPresenting: true },
        presenterUserId: me,
        mediaGeneration: get().mediaGeneration + 1,
      });
    } catch (error) {
      set({ permissionError: classifyMediaError(error, "screen") });
    }
  },

  async stopPresent() {
    const { callId, currentUserId } = get();
    stopScreen();
    if (callId) {
      await api.setCallPresenter(callId, null).catch(() => undefined);
    }
    publishCallEvent("call.present-release", {});
    set({
      local: { ...get().local, isPresenting: false },
      presenterUserId: get().presenterUserId === currentUserId ? null : get().presenterUserId,
      mediaGeneration: get().mediaGeneration + 1,
    });
  },

  async grantPresent(userId) {
    const { callId, moderator, presenterUserId, currentUserId } = get();
    if (!callId) return;
    if (!moderator && presenterUserId !== currentUserId) return;
    await api.setCallPresenter(callId, userId);
    set({
      presentQueue: get().presentQueue.filter((id) => id !== userId),
    });
  },

  dismissPresentRequest() {
    const [, ...rest] = get().presentQueue;
    set({ presentQueue: rest });
  },

  toggleHand() {
    const raised = !get().local.handRaised;
    set({ local: { ...get().local, handRaised: raised } });
    publishCallEvent("call.raise-hand", { raised });
  },

  sendReaction(emoji) {
    const id = crypto.randomUUID();
    const userId = get().currentUserId ?? "";
    publishCallEvent("call.reaction", { emoji, ttlMs: 2500 });
    set({
      reactions: [...get().reactions, { id, userId, emoji, expiresAt: Date.now() + 2500 }],
    });
  },

  async muteOther(userId) {
    const callId = get().callId;
    if (!callId) return;
    await api.muteCallParticipant(callId, userId).catch(() => undefined);
  },

  applyRemoteAccepted(callId) {
    const current = get();
    if (current.callId !== callId) return;
    if (current.status === "ringing-out") {
      set({ status: "connecting" });
    }
  },

  applyRemoteEnded(callId) {
    const current = get();
    if (current.callId !== callId && current.incoming?.callId !== callId) return;
    tearDown();
    set({ ...idle });
  },

  applyPeerMute(isMuted, isVideoOn, fromUserId) {
    const peers = fromUserId ? patchPeer(get().peers, fromUserId, { isMuted, isVideoOn }) : get().peers;
    set({ peerMuted: isMuted, peerVideoOn: isVideoOn, peers });
  },

  applyPeerSpeaking(speaking) {
    set({ peerSpeaking: speaking });
  },

  applyQuality(quality) {
    set({ quality });
  },

  applyConnectionState(state) {
    const current = get();
    if (current.status === "idle" || current.status === "ending" || current.status === "ringing-in") return;
    if (state === "connected") {
      const session = getMediaSession();
      if (session && !session.connectedPosted && current.callId) {
        session.connectedPosted = true;
        void api.markCallConnected(current.callId).catch(() => undefined);
      }
      set({
        status: "active",
        startedAt: current.startedAt ?? Date.now(),
      });
      return;
    }
    if (state === "reconnecting") {
      set({ status: "reconnecting" });
      return;
    }
    if (state === "failed") {
      void get().endCall();
    }
  },

  applySfuProducer(data) {
    const me = get().currentUserId;
    if (data.userId === me) return;
    const patch: Partial<CallPeerState> = { joined: true };
    if (data.source === "camera") patch.isVideoOn = true;
    if (data.source === "screen") patch.isPresenting = true;
    if (data.source === "mic") patch.isMuted = false;
    set({
      peers: patchPeer(get().peers, data.userId, patch),
      mediaGeneration: get().mediaGeneration + 1,
    });
  },

  applySfuProducerClosed(data) {
    closeConsumer(data.producerId);
    const session = getMediaSession();
    const remaining = [...(session?.consumers.values() ?? [])].filter(
      (consumer) => (consumer.appData as { userId?: string }).userId === data.userId,
    );
    const hasCamera = remaining.some((consumer) => (consumer.appData as { source?: TrackSource }).source === "camera");
    const hasScreen = remaining.some((consumer) => (consumer.appData as { source?: TrackSource }).source === "screen");
    const peer = get().peers[data.userId];
    if (peer) {
      set({
        peers: patchPeer(get().peers, data.userId, {
          isVideoOn: hasCamera,
          isPresenting: hasScreen,
        }),
        mediaGeneration: get().mediaGeneration + 1,
      });
    } else {
      set({ mediaGeneration: get().mediaGeneration + 1 });
    }
  },

  applyActiveSpeaker(data) {
    const userId = data.userId;
    const peers = { ...get().peers };
    for (const id of Object.keys(peers)) {
      const peer = peers[id];
      if (peer) peers[id] = { ...peer, speaking: id === userId };
    }
    set({
      activeSpeakerUserId: userId,
      peers,
      peerSpeaking: Boolean(userId && userId === get().peerUserId),
    });
  },

  applyPathChanged() {
    closePeerConnection();
    const current = get();
    const peers = { ...current.peers };
    if (current.peerUserId && !peers[current.peerUserId]) {
      peers[current.peerUserId] = {
        userId: current.peerUserId,
        displayName: current.peerName || "Someone",
        avatarUrl: current.peerAvatarUrl,
        isMuted: current.peerMuted,
        isVideoOn: current.peerVideoOn,
        isPresenting: false,
        handRaised: false,
        speaking: false,
        joined: true,
      };
    }
    set({ mediaPath: "sfu", status: "connecting", peers });
  },

  applyPresenterChanged(data) {
    const me = get().currentUserId;
    const wasMe = get().local.isPresenting;
    const userId = data.userId;
    const peers = { ...get().peers };
    for (const id of Object.keys(peers)) {
      const peer = peers[id];
      if (peer) peers[id] = { ...peer, isPresenting: id === userId };
    }
    set({
      presenterUserId: userId,
      local: { ...get().local, isPresenting: userId === me },
      peers,
      presentQueue: userId ? get().presentQueue.filter((id) => id !== userId) : get().presentQueue,
    });
    if (userId === me) {
      const session = getMediaSession();
      const track = session?.screenStream?.getVideoTracks()[0];
      if (track && !session?.producers.get("screen")) {
        void produceScreen(track).then(() => get().bumpMedia());
      }
    } else if (wasMe) {
      stopScreen();
      set({
        local: { ...get().local, isPresenting: false },
        mediaGeneration: get().mediaGeneration + 1,
      });
    }
    get().bumpMedia();
  },

  applyModerationMute(data) {
    if (data.targetUserId === get().currentUserId) {
      setLocalTrackEnabled("audio", false);
      pauseProducer("mic");
      set({ local: { ...get().local, isMuted: true } });
      return;
    }
    set({
      peers: patchPeer(get().peers, data.targetUserId, { isMuted: true }),
    });
  },

  applyRaiseHand(data) {
    if (data.fromUserId === get().currentUserId) {
      set({ local: { ...get().local, handRaised: data.raised } });
      return;
    }
    set({
      peers: patchPeer(get().peers, data.fromUserId, { handRaised: data.raised }),
    });
  },

  applyReaction(data) {
    if (data.fromUserId === get().currentUserId) return;
    set({
      reactions: [
        ...get().reactions,
        {
          id: crypto.randomUUID(),
          userId: data.fromUserId,
          emoji: data.emoji,
          expiresAt: Date.now() + (data.ttlMs || 2500),
        },
      ],
    });
  },

  applyPresentRequest(userId) {
    const queue = get().presentQueue;
    if (queue.includes(userId)) return;
    set({ presentQueue: [...queue, userId] });
  },

  applyPresentRelease(userId) {
    set({
      presentQueue: get().presentQueue.filter((id) => id !== userId),
    });
  },

  async hydrateFromLink(callId, currentUserId) {
    if (get().status !== "idle") return;
    try {
      const { call } = await api.getCall(callId);
      if (call.status === "connecting" || call.status === "active") {
        await get().joinCall({ callId, currentUserId });
        return;
      }
      if (call.status !== "ringing") return;
      if (call.initiatedBy === currentUserId) {
        const peer = call.participants.find((row) => row.userId !== currentUserId);
        const devices = loadStoredDevices();
        set({
          ...bindCall(call, currentUserId),
          status: "requesting-media",
          type: call.type,
          peerName: peer?.displayName ?? "Someone",
        });
        const acquired = await acquireLocalStream({
          video: call.type === "video",
          micId: devices.mic,
          camId: devices.cam,
        });
        if (get().callId !== call.id) {
          stopStream(acquired.stream);
          return;
        }
        attachLocalStream(call.id, currentUserId, peer?.userId ?? "", acquired.stream);
        set({
          status: "ringing-out",
          permissionError: acquired.permissionError,
          local: {
            ...get().local,
            isVideoOn: acquired.videoEnabled,
          },
          peerVideoOn: call.type === "video",
          mediaGeneration: get().mediaGeneration + 1,
        });
        return;
      }
      const initiator = call.participants.find((row) => row.userId === call.initiatedBy);
      get().receiveInvite({
        callId: call.id,
        conversationId: call.conversationId,
        conversationKind: call.workspaceId ? "channel" : "dm",
        workspaceId: call.workspaceId,
        initiatedBy: call.initiatedBy,
        initiatedByName: initiator?.displayName ?? "Someone",
        type: call.type,
        ringTimeoutMs: call.ringTimeoutMs,
      });
    } catch (error) {
      const permission = error && typeof error === "object" && "kind" in error ? (error as MediaErrorInfo) : null;
      if (get().status === "requesting-media") {
        closeCallMedia();
        set({
          ...idle,
          permissionError: permission,
          error: permission ? null : error instanceof Error ? error.message : "Could not resume call",
        });
        setRealtimeCallId(null);
      }
    }
  },

  async expireIfNeeded() {
    const current = get();
    const deadline = current.incoming?.ringDeadline;
    const ringingOut = current.status === "ringing-out";
    const reactions = current.reactions.filter((row) => row.expiresAt > Date.now());
    if (reactions.length !== current.reactions.length) {
      set({ reactions });
    }
    if (current.status === "ringing-in" && deadline && Date.now() >= deadline && current.callId) {
      const callId = current.callId;
      try {
        await api.getCall(callId);
      } catch {
        // expired
      }
      if (get().callId === callId) {
        tearDown();
        set({ ...idle });
      }
    }
    if (ringingOut && current.callId) {
      try {
        const { call } = await api.getCall(current.callId);
        if (call.status === "missed" || call.status === "ended") {
          get().applyRemoteEnded(call.id);
        } else if (call.status === "connecting" || call.status === "active") {
          get().applyRemoteAccepted(call.id);
        }
      } catch {
        get().applyRemoteEnded(current.callId);
      }
    }
  },

  clearPermissionError() {
    set({ permissionError: null });
  },

  reset() {
    tearDown();
    set({ ...idle });
  },
}));
