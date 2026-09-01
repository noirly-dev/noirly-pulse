export type PermissionErrorKind = "mic" | "camera" | "screen";

export type MediaErrorInfo = {
  kind: PermissionErrorKind;
  message: string;
};

const DEVICE_KEY = "pulse:call-devices";

export type StoredCallDevices = {
  mic?: string;
  cam?: string;
  out?: string;
};

export function loadStoredDevices(): StoredCallDevices {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DEVICE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredCallDevices;
  } catch {
    return {};
  }
}

export function saveStoredDevices(next: StoredCallDevices): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEVICE_KEY, JSON.stringify(next));
}

export function classifyMediaError(error: unknown, fallback: PermissionErrorKind): MediaErrorInfo {
  const name = error instanceof DOMException ? error.name : "";
  const message = error instanceof Error ? error.message : "Could not access media devices";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return { kind: fallback, message: "Permission denied" };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      kind: fallback,
      message: fallback === "camera" ? "No camera found" : "No microphone found",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return { kind: fallback, message: "Device is already in use" };
  }
  return { kind: fallback, message };
}

/** Chrome enumerates "default" / "communications"; `exact` on those ids can fail. */
export function usableDeviceId(deviceId?: string | null): string | undefined {
  if (!deviceId || deviceId === "default" || deviceId === "communications") return undefined;
  return deviceId;
}

function audioConstraints(deviceId?: string | null): MediaTrackConstraints {
  const base: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  const id = usableDeviceId(deviceId);
  if (id) base.deviceId = { exact: id };
  return base;
}

function videoConstraints(deviceId?: string | null, facingMode?: "user" | "environment"): MediaTrackConstraints {
  const base: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };
  const id = usableDeviceId(deviceId);
  if (id) base.deviceId = { exact: id };
  else if (facingMode) base.facingMode = facingMode;
  return base;
}

export async function acquireLocalStream(input: {
  video: boolean;
  micId?: string | null;
  camId?: string | null;
  facingMode?: "user" | "environment";
}): Promise<{ stream: MediaStream; videoEnabled: boolean; permissionError: MediaErrorInfo | null }> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints(input.micId),
      video: input.video ? videoConstraints(input.camId, input.facingMode) : false,
    });
    return { stream, videoEnabled: input.video, permissionError: null };
  } catch (error) {
    if (input.video) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints(input.micId),
          video: false,
        });
        return {
          stream,
          videoEnabled: false,
          permissionError: classifyMediaError(error, "camera"),
        };
      } catch (audioError) {
        throw classifyMediaError(audioError, "mic");
      }
    }
    throw classifyMediaError(error, "mic");
  }
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}
