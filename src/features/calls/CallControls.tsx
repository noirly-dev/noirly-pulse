"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/src/lib/cn";
import { useCallStore } from "@/src/stores/call-store";
import { DeviceMenu } from "@/src/features/calls/DeviceMenu";

const REACTIONS = ["✨", "👍", "❤️", "😂"] as const;

export function CallControls() {
  const type = useCallStore((s) => s.type);
  const mediaPath = useCallStore((s) => s.mediaPath);
  const moderator = useCallStore((s) => s.moderator);
  const isMuted = useCallStore((s) => s.local.isMuted);
  const isVideoOn = useCallStore((s) => s.local.isVideoOn);
  const isPresenting = useCallStore((s) => s.local.isPresenting);
  const handRaised = useCallStore((s) => s.local.handRaised);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const toggleCamera = useCallStore((s) => s.toggleCamera);
  const cycleCamera = useCallStore((s) => s.cycleCamera);
  const toggleHand = useCallStore((s) => s.toggleHand);
  const startPresent = useCallStore((s) => s.startPresent);
  const stopPresent = useCallStore((s) => s.stopPresent);
  const sendReaction = useCallStore((s) => s.sendReaction);
  const endCall = useCallStore((s) => s.endCall);
  const leaveCall = useCallStore((s) => s.leaveCall);
  const [reactionsOpen, setReactionsOpen] = useState(false);

  const sfu = mediaPath === "sfu";

  return (
    <div className="flex items-center justify-center gap-3">
      <ControlButton
        label={isMuted ? "Unmute microphone" : "Mute microphone"}
        pressed={isMuted}
        tone={isMuted ? "warning" : "ghost"}
        onClick={toggleMute}
      >
        {isMuted ? <MicOffIcon /> : <MicIcon />}
      </ControlButton>
      {type === "video" ? (
        <>
          <ControlButton
            label={isVideoOn ? "Turn camera off" : "Turn camera on"}
            pressed={!isVideoOn}
            tone={!isVideoOn ? "warning" : "ghost"}
            onClick={() => void toggleCamera()}
          >
            {isVideoOn ? <VideoIcon /> : <VideoOffIcon />}
          </ControlButton>
          <ControlButton label="Switch camera" onClick={() => void cycleCamera()}>
            <FlipIcon />
          </ControlButton>
        </>
      ) : null}
      <ControlButton
        label={isPresenting ? "Stop presenting" : "Share screen"}
        pressed={isPresenting}
        tone={isPresenting ? "warning" : "ghost"}
        onClick={() => {
          if (isPresenting) void stopPresent();
          else void startPresent();
        }}
      >
        <PresentIcon />
      </ControlButton>
      <ControlButton label={handRaised ? "Lower hand" : "Raise hand"} pressed={handRaised} onClick={toggleHand}>
        <HandIcon />
      </ControlButton>
      <div className="relative">
        <ControlButton
          label="Send reaction"
          pressed={reactionsOpen}
          onClick={() => setReactionsOpen((open) => !open)}
        >
          <span className="text-sm">✨</span>
        </ControlButton>
        {reactionsOpen ? (
          <div className="absolute bottom-12 left-1/2 z-10 flex -translate-x-1/2 gap-1 border border-dashed border-white/20 bg-call-elevated p-1">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="size-8 hover:bg-white/10"
                onClick={() => {
                  sendReaction(emoji);
                  setReactionsOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <DeviceMenu />
      {sfu ? (
        <>
          <ControlButton label="Leave call" tone="danger" onClick={() => void leaveCall()}>
            <HangupIcon />
          </ControlButton>
          {moderator ? (
            <ControlButton label="End everyone" tone="danger" onClick={() => void endCall()}>
              <EndAllIcon />
            </ControlButton>
          ) : null}
        </>
      ) : (
        <ControlButton label="End call" tone="danger" onClick={() => void endCall()}>
          <HangupIcon />
        </ControlButton>
      )}
    </div>
  );
}

function ControlButton({
  label,
  children,
  onClick,
  pressed,
  tone = "ghost",
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  tone?: "ghost" | "warning" | "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex size-10 items-center justify-center border border-dashed transition-colors",
        tone === "ghost" && "border-white/20 text-call-ink hover:bg-white hover:text-call-canvas",
        tone === "warning" && "border-call-warning bg-call-warning text-call-warning-fg",
        tone === "danger" && "border-call-danger bg-call-danger text-white",
      )}
    >
      {children}
    </button>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M4 4l16 16" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="6.5" width="12" height="11" rx="1.5" />
      <path d="M15.5 10.5 20.5 8v8l-5-2.5" />
    </svg>
  );
}

function VideoOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="6.5" width="12" height="11" rx="1.5" />
      <path d="M15.5 10.5 20.5 8v8l-5-2.5M4 4l16 16" />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 12a8 8 0 0 1 14-4M20 12a8 8 0 0 1-14 4" />
      <path d="M18 4v4h-4M6 20v-4h4" />
    </svg>
  );
}

function HangupIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 10c4-4 12-4 16 0M8 14l-3 3M16 14l3 3" />
    </svg>
  );
}

function PresentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M8 11V6.5a1.5 1.5 0 0 1 3 0V11M11 10V5.5a1.5 1.5 0 0 1 3 0V11M14 10V7.5a1.5 1.5 0 0 1 3 0V12c0 3.5-2.5 6-5.5 6S6 15.5 6 12v-1.5a1.5 1.5 0 0 1 3 0V11" />
    </svg>
  );
}

function EndAllIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
