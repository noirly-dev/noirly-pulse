"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Avatar } from "@/src/components/Avatar";
import { cn } from "@/src/lib/cn";
import { getMediaSession } from "@/src/features/calls/media-session";

export function ParticipantTile({
  name,
  avatarUrl,
  local,
  videoOn,
  muted,
  speaking,
  mediaGeneration,
  stream,
  presenting,
  handRaised,
  screen,
}: {
  name: string;
  avatarUrl: string | null;
  local?: boolean;
  videoOn: boolean;
  muted: boolean;
  speaking: boolean;
  mediaGeneration: number;
  stream?: MediaStream | null;
  presenting?: boolean;
  handRaised?: boolean;
  screen?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const session = getMediaSession();
    const next =
      stream !== undefined
        ? stream
        : local
          ? session?.localStream
          : session?.remoteStream;
    if (next && el.srcObject !== next) {
      el.srcObject = next;
    }
    if (!next) {
      el.srcObject = null;
    }
  }, [local, mediaGeneration, videoOn, stream]);

  const showVideo = videoOn || Boolean(screen && stream);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18 }}
      role="group"
      aria-label={`${name}${presenting ? ", presenting" : ""}${muted ? ", muted" : ""}${showVideo ? "" : ", camera off"}`}
      className={cn(
        "relative min-h-0 overflow-hidden border border-dashed border-white/15 bg-call-elevated",
        speaking && "border-solid border-call-accent shadow-[0_0_0_1px_var(--call-accent)]",
        presenting && "border-call-accent",
      )}
    >
      <video
        ref={videoRef}
        id={local && !screen ? "pulse-call-local" : !local && stream === undefined ? "pulse-call-remote" : undefined}
        className={cn(
          "h-full w-full bg-black object-cover",
          local && !screen && "scale-x-[-1]",
          !showVideo && "pointer-events-none absolute inset-0 h-px w-px opacity-0",
        )}
        autoPlay
        playsInline
        muted={local}
      />
      {!showVideo ? (
        <div className="flex h-full min-h-48 items-center justify-center">
          <Avatar name={name} src={avatarUrl} size="lg" className="size-16 text-lg" />
        </div>
      ) : null}
      <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/50 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em]">
        <span>{local ? "You" : name}</span>
        {muted ? <span className="text-call-warning">Muted</span> : null}
        {handRaised ? <span className="text-call-accent">Hand</span> : null}
        {presenting ? <span className="text-call-accent">Presenting</span> : null}
      </div>
    </motion.div>
  );
}
