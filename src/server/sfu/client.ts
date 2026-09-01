import { ApiError } from "@/src/server/api/http";
import type {
  SfuConsumeResult,
  SfuDtlsParameters,
  SfuMediaKind,
  SfuRoomSnapshot,
  SfuRtpCapabilities,
  SfuRtpParameters,
  SfuTrackSource,
  SfuTransportDirection,
  SfuTransportInfo,
} from "@/src/core/calls/sfu";

export type {
  SfuConsumeResult,
  SfuDtlsParameters,
  SfuIceCandidate,
  SfuIceParameters,
  SfuMediaKind,
  SfuProducerInfo,
  SfuRoomSnapshot,
  SfuRtpCapabilities,
  SfuRtpParameters,
  SfuTrackSource,
  SfuTransportDirection,
  SfuTransportInfo,
} from "@/src/core/calls/sfu";

type SfuErrorBody = { error?: string; message?: string };

function sfuBaseUrl(): string {
  const base = process.env.SFU_INTERNAL_URL?.trim();
  if (!base) {
    throw new ApiError(503, "sfu_unavailable", "SFU is not configured");
  }
  return base.replace(/\/$/, "");
}

function sfuSecret(): string {
  const secret = process.env.PULSE_SFU_SHARED_SECRET?.trim();
  if (!secret) {
    throw new ApiError(503, "sfu_unavailable", "SFU is not configured");
  }
  return secret;
}

export async function sfuFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${sfuBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${sfuSecret()}`,
        "content-type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(503, "sfu_unavailable", "SFU is unreachable");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as SfuErrorBody;
    const status = response.status === 401 || response.status >= 500 ? 502 : response.status;
    throw new ApiError(
      status === 404 ? 404 : status,
      body.error ?? "sfu_error",
      body.message ?? "SFU request failed",
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function ensureSfuRoom(callId: string): Promise<SfuRoomSnapshot> {
  return sfuFetch<SfuRoomSnapshot>("/internal/rooms", {
    method: "POST",
    body: JSON.stringify({ callId }),
  });
}

export function getSfuRoom(callId: string): Promise<SfuRoomSnapshot> {
  return sfuFetch<SfuRoomSnapshot>(`/internal/rooms/${encodeURIComponent(callId)}`);
}

export async function deleteSfuRoom(callId: string): Promise<void> {
  await sfuFetch<{ ok: boolean }>(`/internal/rooms/${encodeURIComponent(callId)}`, {
    method: "DELETE",
  });
}

export function createSfuTransport(
  callId: string,
  userId: string,
  direction: SfuTransportDirection,
): Promise<SfuTransportInfo> {
  return sfuFetch<SfuTransportInfo>(
    `/internal/rooms/${encodeURIComponent(callId)}/transports`,
    {
      method: "POST",
      body: JSON.stringify({ userId, direction }),
    },
  );
}

export async function connectSfuTransport(
  callId: string,
  transportId: string,
  dtlsParameters: SfuDtlsParameters,
): Promise<void> {
  await sfuFetch<{ ok: boolean }>(
    `/internal/rooms/${encodeURIComponent(callId)}/transports/${encodeURIComponent(transportId)}/connect`,
    {
      method: "POST",
      body: JSON.stringify({ dtlsParameters }),
    },
  );
}

export function sfuProduce(
  callId: string,
  input: {
    userId: string;
    transportId: string;
    kind: SfuMediaKind;
    rtpParameters: SfuRtpParameters;
    source: SfuTrackSource;
  },
): Promise<{ producerId: string }> {
  return sfuFetch<{ producerId: string }>(
    `/internal/rooms/${encodeURIComponent(callId)}/producers`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function sfuConsume(
  callId: string,
  input: {
    userId: string;
    producerId: string;
    rtpCapabilities: SfuRtpCapabilities;
  },
): Promise<SfuConsumeResult> {
  return sfuFetch<SfuConsumeResult>(
    `/internal/rooms/${encodeURIComponent(callId)}/consumers`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function resumeSfuConsumer(callId: string, consumerId: string): Promise<void> {
  await sfuFetch<{ ok: boolean }>(
    `/internal/rooms/${encodeURIComponent(callId)}/consumers/${encodeURIComponent(consumerId)}/resume`,
    { method: "POST" },
  );
}

export async function setSfuConsumerLayers(
  callId: string,
  consumerId: string,
  layers: { spatialLayer: number; temporalLayer?: number },
): Promise<void> {
  await sfuFetch<{ ok: boolean }>(
    `/internal/rooms/${encodeURIComponent(callId)}/consumers/${encodeURIComponent(consumerId)}/layers`,
    {
      method: "POST",
      body: JSON.stringify(layers),
    },
  );
}

export async function pauseSfuProducer(callId: string, producerId: string): Promise<void> {
  await sfuFetch<{ ok: boolean }>(
    `/internal/rooms/${encodeURIComponent(callId)}/producers/${encodeURIComponent(producerId)}/pause`,
    { method: "POST" },
  );
}

export async function resumeSfuProducer(callId: string, producerId: string): Promise<void> {
  await sfuFetch<{ ok: boolean }>(
    `/internal/rooms/${encodeURIComponent(callId)}/producers/${encodeURIComponent(producerId)}/resume`,
    { method: "POST" },
  );
}
