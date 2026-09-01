"use client";

import { useEffect, useMemo } from "react";
import { preferredSpatialLayer, tileColumns } from "@/src/features/calls/grid-layout";
import { getMediaSession } from "@/src/features/calls/media-session";
import { ParticipantTile } from "@/src/features/calls/ParticipantTile";
import { applyPreferredLayers } from "@/src/features/calls/webrtc-sfu";
import { useCallStore } from "@/src/stores/call-store";

export function ParticipantGrid() {
  const peers = useCallStore((s) => s.peers);
  const local = useCallStore((s) => s.local);
  const type = useCallStore((s) => s.type);
  const currentUserId = useCallStore((s) => s.currentUserId);
  const presenterUserId = useCallStore((s) => s.presenterUserId);
  const activeSpeakerUserId = useCallStore((s) => s.activeSpeakerUserId);
  const mediaGeneration = useCallStore((s) => s.mediaGeneration);

  const session = getMediaSession();
  const tiles = useMemo(() => {
    const selfId = currentUserId ?? "self";
    const rows = [
      {
        userId: selfId,
        name: "You",
        avatarUrl: null as string | null,
        local: true,
        stream: session?.localStream ?? null,
        videoOn: type === "video" && local.isVideoOn,
        muted: local.isMuted,
        speaking: activeSpeakerUserId === currentUserId,
        presenting: local.isPresenting,
        handRaised: local.handRaised,
        screen: false,
      },
      ...Object.values(peers).map((peer) => ({
        userId: peer.userId,
        name: peer.displayName,
        avatarUrl: peer.avatarUrl,
        local: false,
        stream: session?.remoteStreams.get(peer.userId) ?? null,
        videoOn: peer.isVideoOn,
        muted: peer.isMuted,
        speaking: peer.speaking || activeSpeakerUserId === peer.userId,
        presenting: peer.isPresenting,
        handRaised: peer.handRaised,
        screen: false,
      })),
    ];
    return rows;
  }, [
    activeSpeakerUserId,
    currentUserId,
    local.handRaised,
    local.isMuted,
    local.isPresenting,
    local.isVideoOn,
    mediaGeneration,
    peers,
    session?.localStream,
    session?.remoteStreams,
    type,
  ]);

  const count = tiles.length;
  const cols = tileColumns(count);
  const layer = preferredSpatialLayer(count);

  useEffect(() => {
    applyPreferredLayers(layer);
  }, [layer, mediaGeneration]);

  if (presenterUserId) {
    const presenter = tiles.find((tile) => tile.userId === presenterUserId);
    const screenStream =
      presenterUserId === currentUserId
        ? session?.screenStream ?? null
        : session?.screenStreams.get(presenterUserId) ?? null;
    const stageStream = screenStream ?? presenter?.stream ?? null;
    const strip = tiles.filter((tile) => tile.userId !== presenterUserId || Boolean(screenStream));

    return (
      <div className="flex min-h-0 flex-1 gap-3 p-4">
        <div className="min-h-0 min-w-0 flex-[3]">
          <ParticipantTile
            name={presenter?.name ?? "Presenter"}
            avatarUrl={presenter?.avatarUrl ?? null}
            local={presenter?.local}
            videoOn={Boolean(stageStream)}
            muted={presenter?.muted ?? false}
            speaking={presenter?.speaking ?? false}
            mediaGeneration={mediaGeneration}
            stream={stageStream}
            presenting
            handRaised={presenter?.handRaised}
            screen={Boolean(screenStream)}
          />
        </div>
        <div className="flex w-36 shrink-0 flex-col gap-2 overflow-y-auto md:w-44">
          {strip.map((tile) => (
            <div key={tile.userId} className="min-h-24 shrink-0">
              <ParticipantTile
                name={tile.name}
                avatarUrl={tile.avatarUrl}
                local={tile.local}
                videoOn={tile.videoOn}
                muted={tile.muted}
                speaking={tile.speaking}
                mediaGeneration={mediaGeneration}
                stream={tile.stream}
                presenting={tile.presenting && !screenStream}
                handRaised={tile.handRaised}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {tiles.map((tile) => (
        <ParticipantTile
          key={tile.userId}
          name={tile.name}
          avatarUrl={tile.avatarUrl}
          local={tile.local}
          videoOn={tile.videoOn}
          muted={tile.muted}
          speaking={tile.speaking}
          mediaGeneration={mediaGeneration}
          stream={tile.stream}
          presenting={tile.presenting}
          handRaised={tile.handRaised}
        />
      ))}
    </div>
  );
}
