"use client";

import { useEffect, useState } from "react";
import { useCallStore } from "@/src/stores/call-store";

export function DeviceMenu() {
  const selectDevice = useCallStore((s) => s.selectDevice);
  const micId = useCallStore((s) => s.local.deviceIdMic);
  const camId = useCallStore((s) => s.local.deviceIdCam);
  const outId = useCallStore((s) => s.local.deviceIdOut);
  const type = useCallStore((s) => s.type);
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (!open) return;
    void navigator.mediaDevices.enumerateDevices().then(setDevices);
  }, [open]);

  const mics = devices.filter((device) => device.kind === "audioinput" && device.deviceId);
  const cams = devices.filter((device) => device.kind === "videoinput" && device.deviceId);
  const outs = devices.filter((device) => device.kind === "audiooutput" && device.deviceId);

  return (
    <div className="relative">
      <button
        type="button"
        className="size-10 border border-dashed border-white/20 text-white/70 hover:bg-white hover:text-call-canvas"
        aria-label="Select devices"
        onClick={() => setOpen((value) => !value)}
      >
        <GearIcon />
      </button>
      {open ? (
        <div className="absolute bottom-12 right-0 z-10 w-64 border border-dashed border-white/20 bg-call-elevated p-3 text-left text-sm text-call-ink">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Microphone</p>
          {mics.map((device) => (
            <DeviceOption
              key={device.deviceId}
              label={device.label || "Microphone"}
              selected={device.deviceId === micId}
              onClick={() => {
                void selectDevice("mic", device.deviceId);
                setOpen(false);
              }}
            />
          ))}
          {type === "video" ? (
            <>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Camera</p>
              {cams.map((device) => (
                <DeviceOption
                  key={device.deviceId}
                  label={device.label || "Camera"}
                  selected={device.deviceId === camId}
                  onClick={() => {
                    void selectDevice("cam", device.deviceId);
                    setOpen(false);
                  }}
                />
              ))}
            </>
          ) : null}
          {outs.length > 0 ? (
            <>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Speaker</p>
              {outs.map((device) => (
                <DeviceOption
                  key={device.deviceId}
                  label={device.label || "Speaker"}
                  selected={device.deviceId === outId}
                  onClick={() => {
                    void selectDevice("out", device.deviceId);
                    setOpen(false);
                  }}
                />
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DeviceOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`mt-1 block w-full truncate px-2 py-1 text-left hover:bg-white hover:text-call-canvas ${selected ? "text-call-accent" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mx-auto size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M6.2 17.8l1.4-1.4M16.4 7.6l1.4-1.4" />
    </svg>
  );
}
