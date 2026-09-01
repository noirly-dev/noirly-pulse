import { Device, types as MediasoupTypes } from "mediasoup-client";
import type { TrackSource } from "@/src/core/calls/protocol";
import type { SfuProducerInfo } from "@/src/core/calls/sfu";
import {
  closePeerConnection,
  closeSfuMedia,
  getMediaSession,
} from "@/src/features/calls/media-session";
import { stopStream } from "@/src/features/calls/permissions";
import { api } from "@/src/lib/api-client";

export type SfuCallbacks = {
  onRemoteStream: (userId: string, source: TrackSource) => void;
  onConnectionState: (state: "connecting" | "connected" | "reconnecting" | "failed") => void;
};

const CAMERA_ENCODINGS: MediasoupTypes.RtpEncodingParameters[] = [
  { rid: "q", maxBitrate: 150_000, scaleResolutionDownBy: 4 },
  { rid: "h", maxBitrate: 500_000, scaleResolutionDownBy: 2 },
  { rid: "f", maxBitrate: 1_200_000, scaleResolutionDownBy: 1 },
];

let startLock: Promise<void> | null = null;
let callbacks: SfuCallbacks | null = null;

type ProducerAppData = { source: TrackSource };
type ConsumerAppData = { userId: string; source: TrackSource };

function asRtpCapabilities(value: unknown): MediasoupTypes.RtpCapabilities {
  return value as MediasoupTypes.RtpCapabilities;
}

function asIceParameters(value: unknown): MediasoupTypes.IceParameters {
  return value as MediasoupTypes.IceParameters;
}

function asIceCandidates(value: unknown): MediasoupTypes.IceCandidate[] {
  return value as MediasoupTypes.IceCandidate[];
}

function asDtlsParameters(value: unknown): MediasoupTypes.DtlsParameters {
  return value as MediasoupTypes.DtlsParameters;
}

function asRtpParameters(value: unknown): MediasoupTypes.RtpParameters {
  return value as MediasoupTypes.RtpParameters;
}

function bindTransportConnect(
  callId: string,
  transport: MediasoupTypes.Transport,
  onState: SfuCallbacks["onConnectionState"],
) {
  transport.on("connect", ({ dtlsParameters }, next, errback) => {
    void api
      .sfuConnectTransport(callId, transport.id, dtlsParameters)
      .then(() => next())
      .catch((error: unknown) => errback(error instanceof Error ? error : new Error("connect failed")));
  });
  transport.on("connectionstatechange", (state) => {
    if (state === "connected") onState("connected");
    else if (state === "connecting") onState("connecting");
    else if (state === "disconnected") onState("reconnecting");
    else if (state === "failed") onState("failed");
  });
}

async function produceTrack(source: TrackSource, track: MediaStreamTrack): Promise<void> {
  const session = getMediaSession();
  const send = session?.sendTransport;
  if (!session || !send || send.closed) return;
  const existing = session.producers.get(source);
  if (existing && !existing.closed) {
    await existing.replaceTrack({ track });
    if (existing.paused) existing.resume();
    return;
  }
  const isCamera = source === "camera";
  const isScreen = source === "screen";
  const producer = await send.produce({
    track,
    encodings: isCamera ? CAMERA_ENCODINGS : isScreen ? [{ maxBitrate: 2_000_000 }] : undefined,
    codecOptions: isCamera
      ? { videoGoogleStartBitrate: 1000 }
      : source === "mic"
        ? { opusDtx: true }
        : undefined,
    appData: { source } satisfies ProducerAppData,
    stopTracks: false,
  });
  session.producers.set(source, producer);
}

function attachConsumerTrack(
  userId: string,
  source: TrackSource,
  track: MediaStreamTrack,
): void {
  const session = getMediaSession();
  if (!session) return;
  const map = source === "screen" ? session.screenStreams : session.remoteStreams;
  let stream = map.get(userId);
  if (!stream) {
    stream = new MediaStream();
    map.set(userId, stream);
  }
  const sameKind = stream.getTracks().filter((entry) => entry.kind === track.kind);
  for (const old of sameKind) {
    stream.removeTrack(old);
  }
  stream.addTrack(track);
}

export async function consumeProducer(info: {
  producerId: string;
  userId: string;
  kind: "audio" | "video";
  source: TrackSource;
}): Promise<void> {
  const session = getMediaSession();
  if (!session?.device?.loaded || !session.recvTransport || session.recvTransport.closed) return;
  if (info.userId === session.localUserId) return;
  if (session.consumers.has(info.producerId)) return;

  const result = await api.sfuConsume(session.callId, {
    producerId: info.producerId,
    rtpCapabilities: session.device.rtpCapabilities,
  });
  const consumer = await session.recvTransport.consume({
    id: result.consumerId,
    producerId: result.producerId,
    kind: result.kind,
    rtpParameters: asRtpParameters(result.rtpParameters),
    appData: { userId: info.userId, source: info.source } satisfies ConsumerAppData,
  });
  session.consumers.set(info.producerId, consumer);
  await api.sfuResumeConsumer(session.callId, consumer.id).catch(() => undefined);
  attachConsumerTrack(info.userId, info.source, consumer.track);
  callbacks?.onRemoteStream(info.userId, info.source);
}

export function closeConsumer(producerId: string): void {
  const session = getMediaSession();
  if (!session) return;
  const consumer = session.consumers.get(producerId);
  if (!consumer) return;
  const userId = (consumer.appData as ConsumerAppData).userId;
  const source = (consumer.appData as ConsumerAppData).source;
  try {
    consumer.close();
  } catch {
    // already closed
  }
  session.consumers.delete(producerId);
  if (!userId) return;
  const map = source === "screen" ? session.screenStreams : session.remoteStreams;
  const stream = map.get(userId);
  if (!stream) return;
  try {
    stream.removeTrack(consumer.track);
    consumer.track.stop();
  } catch {
    // already ended
  }
  if (stream.getTracks().length === 0) {
    map.delete(userId);
  }
}

export async function produceScreen(track: MediaStreamTrack): Promise<void> {
  await produceTrack("screen", track);
}

export function stopScreen(): void {
  const session = getMediaSession();
  if (!session) return;
  const producer = session.producers.get("screen");
  if (producer) {
    try {
      producer.close();
    } catch {
      // already closed
    }
    session.producers.delete("screen");
  }
  stopStream(session.screenStream);
  session.screenStream = null;
}

export function pauseProducer(source: TrackSource): void {
  const producer = getMediaSession()?.producers.get(source);
  if (producer && !producer.closed && !producer.paused) producer.pause();
}

export function resumeProducer(source: TrackSource): void {
  const producer = getMediaSession()?.producers.get(source);
  if (producer && !producer.closed && producer.paused) producer.resume();
}

export async function replaceSfuTrack(
  source: TrackSource,
  track: MediaStreamTrack | null,
): Promise<void> {
  const session = getMediaSession();
  const existing = session?.producers.get(source);
  if (existing && !existing.closed) {
    await existing.replaceTrack({ track });
    return;
  }
  if (track && session?.sendTransport && !session.sendTransport.closed) {
    await produceTrack(source, track);
  }
}

export function setPreferredLayer(producerId: string, spatialLayer: number): void {
  const session = getMediaSession();
  const consumer = session?.consumers.get(producerId);
  if (!session || !consumer || consumer.closed || consumer.kind !== "video") return;
  const source = (consumer.appData as ConsumerAppData).source;
  if (source === "screen") return;
  void api
    .sfuSetConsumerLayers(session.callId, consumer.id, { spatialLayer })
    .catch(() => undefined);
}

export function applyPreferredLayers(spatialLayer: number): void {
  const session = getMediaSession();
  if (!session) return;
  for (const producerId of session.consumers.keys()) {
    setPreferredLayer(producerId, spatialLayer);
  }
}

export function closeSfuSession(): void {
  closeSfuMedia();
}

async function produceLocalTracks(): Promise<void> {
  const session = getMediaSession();
  const stream = session?.localStream;
  if (!session || !stream) return;
  const audio = stream.getAudioTracks()[0];
  if (audio) {
    await produceTrack("mic", audio);
    if (!audio.enabled) pauseProducer("mic");
  }
  const video = stream.getVideoTracks()[0];
  if (video) {
    await produceTrack("camera", video);
    if (!video.enabled) pauseProducer("camera");
  }
}

async function startSfuSessionInner(opts: { callId: string; callbacks: SfuCallbacks }): Promise<void> {
  const session = getMediaSession();
  if (!session?.localStream) throw new Error("Local media is not ready");
  if (session.callId === opts.callId && session.sendTransport && !session.sendTransport.closed) {
    return;
  }

  callbacks = opts.callbacks;
  if (session.pc) closePeerConnection();
  session.path = "sfu";

  const room = await api.sfuJoin(opts.callId);
  const device = session.device?.loaded ? session.device : new Device();
  if (!device.loaded) {
    await device.load({ routerRtpCapabilities: asRtpCapabilities(room.routerRtpCapabilities) });
  }
  session.device = device;

  let iceServers: RTCIceServer[] = session.iceServers;
  if (!iceServers.length) {
    try {
      const ice = await api.iceServers();
      iceServers = ice.iceServers;
      session.iceServers = ice.iceServers;
    } catch {
      iceServers = [];
    }
  }

  const sendInfo = await api.sfuCreateTransport(opts.callId, "send");
  const recvInfo = await api.sfuCreateTransport(opts.callId, "recv");

  const sendTransport = device.createSendTransport({
    id: sendInfo.transportId,
    iceParameters: asIceParameters(sendInfo.iceParameters),
    iceCandidates: asIceCandidates(sendInfo.iceCandidates),
    dtlsParameters: asDtlsParameters(sendInfo.dtlsParameters),
    iceServers,
  });
  const recvTransport = device.createRecvTransport({
    id: recvInfo.transportId,
    iceParameters: asIceParameters(recvInfo.iceParameters),
    iceCandidates: asIceCandidates(recvInfo.iceCandidates),
    dtlsParameters: asDtlsParameters(recvInfo.dtlsParameters),
    iceServers,
  });

  bindTransportConnect(opts.callId, sendTransport, opts.callbacks.onConnectionState);
  bindTransportConnect(opts.callId, recvTransport, opts.callbacks.onConnectionState);

  sendTransport.on("produce", ({ kind, rtpParameters, appData }, next, errback) => {
    const source = (appData as ProducerAppData).source;
    void api
      .sfuProduce(opts.callId, {
        transportId: sendTransport.id,
        kind,
        rtpParameters,
        source,
      })
      .then(({ producerId }) => next({ id: producerId }))
      .catch((error: unknown) => errback(error instanceof Error ? error : new Error("produce failed")));
  });

  session.sendTransport = sendTransport;
  session.recvTransport = recvTransport;

  opts.callbacks.onConnectionState("connecting");
  await produceLocalTracks();

  const existing = (room.producers ?? []) as SfuProducerInfo[];
  for (const producer of existing) {
    if (producer.userId === session.localUserId) continue;
    await consumeProducer(producer).catch(() => undefined);
  }

  opts.callbacks.onConnectionState("connected");
}

export async function startSfuSession(opts: {
  callId: string;
  callbacks: SfuCallbacks;
}): Promise<void> {
  const session = getMediaSession();
  if (session?.callId === opts.callId && session.sendTransport && !session.sendTransport.closed) {
    callbacks = opts.callbacks;
    return;
  }
  if (startLock) {
    await startLock;
    const after = getMediaSession();
    if (after?.callId === opts.callId && after.sendTransport && !after.sendTransport.closed) {
      callbacks = opts.callbacks;
      return;
    }
  }
  startLock = startSfuSessionInner(opts);
  try {
    await startLock;
  } finally {
    startLock = null;
  }
}
