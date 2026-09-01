export type SfuTrackSource = "mic" | "camera" | "screen";
export type SfuMediaKind = "audio" | "video";
export type SfuTransportDirection = "send" | "recv";

export type SfuRtpCapabilities = Record<string, unknown>;
export type SfuRtpParameters = Record<string, unknown>;
export type SfuDtlsParameters = Record<string, unknown>;
export type SfuIceParameters = Record<string, unknown>;
export type SfuIceCandidate = Record<string, unknown>;

export type SfuProducerInfo = {
  producerId: string;
  userId: string;
  kind: SfuMediaKind;
  source: SfuTrackSource;
};

export type SfuRoomSnapshot = {
  callId: string;
  routerRtpCapabilities: SfuRtpCapabilities;
  producers: SfuProducerInfo[];
};

export type SfuTransportInfo = {
  transportId: string;
  iceParameters: SfuIceParameters;
  iceCandidates: SfuIceCandidate[];
  dtlsParameters: SfuDtlsParameters;
};

export type SfuConsumeResult = {
  consumerId: string;
  producerId: string;
  kind: SfuMediaKind;
  rtpParameters: SfuRtpParameters;
  producerPaused: boolean;
};
