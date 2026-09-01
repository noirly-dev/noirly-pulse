import type { CallType, ConversationKind } from "@/src/core/models/enums";

export type MediaPath = "p2p" | "sfu";
export type TrackSource = "mic" | "camera" | "screen";
export type LeaveReason = "hangup" | "kicked" | "timeout" | "migrate" | "error";
export type EndReason = "hangup" | "timeout" | "failed" | "replaced";

export interface CallSignalBase {
  callId: string;
  fromUserId: string;
  toUserId?: string;
  seq: number;
  occurredAt: number;
}

export interface InboxCallInviteData {
  callId: string;
  conversationId: string;
  conversationKind: ConversationKind;
  workspaceId: string | null;
  initiatedBy: string;
  initiatedByName: string;
  type: CallType;
  ringTimeoutMs: number;
}

export interface InboxCallLifecycleData {
  callId: string;
  conversationId: string;
  reason?: string;
}

export interface WebrtcOfferData extends CallSignalBase {
  sdp: string;
  mediaPath: "p2p";
}

export interface WebrtcAnswerData extends CallSignalBase {
  sdp: string;
}

export interface WebrtcIceBatchData extends CallSignalBase {
  candidates: RTCIceCandidateInit[];
}

export interface MuteStateData extends CallSignalBase {
  isMuted: boolean;
  isVideoOn: boolean;
}

export interface ReactionData extends CallSignalBase {
  emoji: string;
  ttlMs: number;
}

export interface RaiseHandData extends CallSignalBase {
  raised: boolean;
}

export interface PresentRequestData extends CallSignalBase {}

export interface SfuNewProducerData {
  producerId: string;
  userId: string;
  kind: "audio" | "video";
  source: TrackSource;
}

export interface SfuProducerClosedData {
  producerId: string;
  userId: string;
}

export interface SfuActiveSpeakerData {
  userId: string | null;
  level: number;
}

export interface CallPathChangedData {
  mediaPath: "sfu";
  reason: "participant-added" | "kind-changed";
}

export interface PresenterChangedData {
  userId: string | null;
}

export interface ModerationMuteData {
  targetUserId: string;
  isMuted: true;
  byUserId: string;
}
