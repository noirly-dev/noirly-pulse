"use client";

import {
  useChannel,
  usePresence,
  useRealtimeClient,
  useRealtimeEvent,
} from "@noirly-dev/realtime-client/react";
import { useEffect, useRef } from "react";
import { pulseChannel } from "@/src/core/realtime/channels";
import type {
  CallPathChangedData,
  ModerationMuteData,
  MuteStateData,
  PresenterChangedData,
  PresentRequestData,
  ReactionData,
  RaiseHandData,
  SfuActiveSpeakerData,
  SfuNewProducerData,
  SfuProducerClosedData,
  WebrtcAnswerData,
  WebrtcIceBatchData,
  WebrtcOfferData,
} from "@/src/core/calls/protocol";
import { setCallEventPublisher } from "@/src/features/calls/call-publish";
import { nextSignalSeq } from "@/src/features/calls/media-session";
import { handleP2PSignal, startPeerConnection, type P2PSend } from "@/src/features/calls/webrtc-p2p";
import { consumeProducer, startSfuSession } from "@/src/features/calls/webrtc-sfu";
import { api } from "@/src/lib/api-client";
import { useCallStore } from "@/src/stores/call-store";

type Props = {
  userId: string;
  callId: string;
  displayName: string;
  avatarUrl: string | null;
};

export function CallSignaling({ userId, callId, displayName, avatarUrl }: Props) {
  const client = useRealtimeClient();
  const status = useCallStore((s) => s.status);
  const peerUserId = useCallStore((s) => s.peerUserId);
  const mediaPath = useCallStore((s) => s.mediaPath);
  const isMuted = useCallStore((s) => s.local.isMuted);
  const isVideoOn = useCallStore((s) => s.local.isVideoOn);
  const isPresenting = useCallStore((s) => s.local.isPresenting);
  const handRaised = useCallStore((s) => s.local.handRaised);
  const channel = pulseChannel.call(callId);
  const sendRef = useRef<P2PSend | null>(null);

  useChannel(channel, { presence: true, replayLimit: 0 });
  const { join, leave, update } = usePresence(channel, { collapseByUserId: true });

  useEffect(() => {
    setCallEventPublisher((event, data) => {
      void client.publish(
        channel,
        event,
        {
          callId,
          fromUserId: userId,
          seq: nextSignalSeq(),
          occurredAt: Date.now(),
          ...data,
        },
        { ephemeral: true },
      );
    });
    return () => setCallEventPublisher(null);
  }, [client, channel, callId, userId]);

  useEffect(() => {
    if (!peerUserId) {
      sendRef.current = null;
      return;
    }
    sendRef.current = (event, data) => {
      void client.publish(
        channel,
        event,
        {
          callId,
          fromUserId: userId,
          toUserId: peerUserId,
          seq: nextSignalSeq(),
          occurredAt: Date.now(),
          ...data,
        },
        { ephemeral: true },
      );
    };
  }, [client, channel, callId, peerUserId, userId]);

  const inCall =
    status === "ringing-out" ||
    status === "connecting" ||
    status === "active" ||
    status === "reconnecting" ||
    status === "ending";

  useEffect(() => {
    if (!inCall) return;
    void join({
      displayName,
      avatarUrl,
      isMuted,
      isVideoOn,
      isPresenting,
      handRaised,
      mediaPath: mediaPath ?? "p2p",
    });
    return () => {
      void leave();
    };
    // Mute/camera updates go through presence.update; re-joining on those would flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- join once per in-call session
  }, [inCall, join, leave, displayName, avatarUrl]);

  useEffect(() => {
    if (status === "idle" || status === "ringing-in" || status === "requesting-media") return;
    void update({
      displayName,
      avatarUrl,
      isMuted,
      isVideoOn,
      isPresenting,
      handRaised,
      mediaPath: mediaPath ?? "p2p",
    });
    if (status === "connecting" || status === "active" || status === "reconnecting") {
      void client.publish(
        channel,
        "call.mute-state",
        {
          callId,
          fromUserId: userId,
          toUserId: peerUserId ?? undefined,
          seq: nextSignalSeq(),
          occurredAt: Date.now(),
          isMuted,
          isVideoOn,
        },
        { ephemeral: true },
      );
    }
  }, [
    isMuted,
    isVideoOn,
    isPresenting,
    handRaised,
    mediaPath,
    status,
    update,
    displayName,
    avatarUrl,
    client,
    channel,
    callId,
    userId,
    peerUserId,
  ]);

  useEffect(() => {
    if (mediaPath === "sfu") return;
    if (status !== "connecting" && status !== "active" && status !== "reconnecting") return;
    if (!peerUserId) return;
    const send: P2PSend = (event, data) => {
      void client.publish(
        channel,
        event,
        {
          callId,
          fromUserId: userId,
          toUserId: peerUserId,
          seq: nextSignalSeq(),
          occurredAt: Date.now(),
          ...data,
        },
        { ephemeral: true },
      );
    };
    sendRef.current = send;
    let cancelled = false;
    void (async () => {
      const { iceServers } = await api.iceServers();
      if (cancelled) return;
      await startPeerConnection({
        iceServers,
        callbacks: {
          send,
          onRemoteStream: () => useCallStore.getState().bumpMedia(),
          onConnectionState: (state) => useCallStore.getState().applyConnectionState(state),
          onQuality: (quality) => useCallStore.getState().applyQuality(quality),
          onSpeaking: (speaking) => useCallStore.getState().applyPeerSpeaking(speaking),
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [callId, status, peerUserId, client, channel, userId, mediaPath]);

  useEffect(() => {
    if (mediaPath !== "sfu") return;
    if (
      status !== "ringing-out" &&
      status !== "connecting" &&
      status !== "active" &&
      status !== "reconnecting"
    ) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await startSfuSession({
          callId,
          callbacks: {
            onRemoteStream: () => useCallStore.getState().bumpMedia(),
            onConnectionState: (state) => useCallStore.getState().applyConnectionState(state),
          },
        });
      } catch {
        if (!cancelled) useCallStore.getState().applyConnectionState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [callId, status, mediaPath]);

  function onSignal(event: string, data: { fromUserId?: string; toUserId?: string; sdp?: string; candidates?: RTCIceCandidateInit[] }) {
    if (data.fromUserId === userId) return;
    if (data.toUserId && data.toUserId !== userId) return;
    const send: P2PSend = sendRef.current ?? ((eventName, payload) => {
      if (!peerUserId) return;
      void client.publish(
        channel,
        eventName,
        {
          callId,
          fromUserId: userId,
          toUserId: peerUserId,
          seq: nextSignalSeq(),
          occurredAt: Date.now(),
          ...payload,
        },
        { ephemeral: true },
      );
    });
    void handleP2PSignal(event, data, send);
  }

  useRealtimeEvent<WebrtcOfferData>(channel, "webrtc.offer", (data) => onSignal("webrtc.offer", data));
  useRealtimeEvent<WebrtcOfferData>(channel, "webrtc.ice-restart-offer", (data) =>
    onSignal("webrtc.ice-restart-offer", data),
  );
  useRealtimeEvent<WebrtcAnswerData>(channel, "webrtc.answer", (data) => onSignal("webrtc.answer", data));
  useRealtimeEvent<WebrtcIceBatchData>(channel, "webrtc.ice-batch", (data) => onSignal("webrtc.ice-batch", data));
  useRealtimeEvent<MuteStateData>(channel, "call.mute-state", (data) => {
    if (data.fromUserId === userId) return;
    useCallStore.getState().applyPeerMute(data.isMuted, data.isVideoOn, data.fromUserId);
  });
  useRealtimeEvent<SfuNewProducerData>(channel, "sfu.new-producer", (data) => {
    if (data.userId === userId) return;
    useCallStore.getState().applySfuProducer(data);
    void consumeProducer(data);
  });
  useRealtimeEvent<SfuProducerClosedData>(channel, "sfu.producer-closed", (data) => {
    if (data.userId === userId) return;
    useCallStore.getState().applySfuProducerClosed(data);
  });
  useRealtimeEvent<SfuActiveSpeakerData>(channel, "sfu.active-speaker", (data) => {
    useCallStore.getState().applyActiveSpeaker(data);
  });
  useRealtimeEvent<CallPathChangedData>(channel, "call.path-changed", () => {
    useCallStore.getState().applyPathChanged();
  });
  useRealtimeEvent<PresenterChangedData>(channel, "call.presenter-changed", (data) => {
    useCallStore.getState().applyPresenterChanged(data);
  });
  useRealtimeEvent<ModerationMuteData>(channel, "call.moderation.mute", (data) => {
    useCallStore.getState().applyModerationMute(data);
  });
  useRealtimeEvent<RaiseHandData>(channel, "call.raise-hand", (data) => {
    if (data.fromUserId === userId) return;
    useCallStore.getState().applyRaiseHand(data);
  });
  useRealtimeEvent<ReactionData>(channel, "call.reaction", (data) => {
    if (data.fromUserId === userId) return;
    useCallStore.getState().applyReaction(data);
  });
  useRealtimeEvent<PresentRequestData>(channel, "call.present-request", (data) => {
    if (data.fromUserId === userId) return;
    useCallStore.getState().applyPresentRequest(data.fromUserId);
  });
  useRealtimeEvent<PresentRequestData>(channel, "call.present-release", (data) => {
    if (data.fromUserId === userId) return;
    useCallStore.getState().applyPresentRelease(data.fromUserId);
  });

  return null;
}
