# Noirly Pulse — Calling Architecture

**Product:** Noirly Pulse (web)  
**Audience:** Principal frontend / full-stack implementation  
**Status:** Architecture decision record — calling system (MVP → v2)  
**Companion:** [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) (messaging, realtime, RBAC)  
**Stack additions:** native WebRTC · `mediasoup` (self-hosted SFU) · `mediasoup-client` · `coturn` (TURN/STUN) · Zustand `CallStore` · Framer Motion (call overlay)

This document is the source of truth for audio/video calling. Messaging architecture remains in `ARCHITECTURE.md`. Where the two overlap (channels, JWT caps, notifications, design tokens), this document extends those contracts — it does not fork them.

---

## Locked decisions

| Decision | Choice | Justification |
| --- | --- | --- |
| **Media transport** | Native browser WebRTC (`RTCPeerConnection`, `getUserMedia`, `getDisplayMedia`) | Fully owned stack. No Twilio / Daily.co / Agora / LiveKit Cloud. |
| **Signaling** | `@noirly-dev/realtime-client` on channel `call:{callId}` | Same self-hosted WS engine as chat. Package name is `@noirly-dev/*` (GitHub Packages), not `@noirly/*`. |
| **Group media** | **mediasoup** SFU, self-hosted as `noirly-sfu` | Media-only library with **no signaling plane** — the exact split noirly-realtime already owns. See §3. |
| **1:1 media** | Direct P2P `RTCPeerConnection` | Lowest latency; no SFU hop. TURN (`coturn`) still required for NAT. |
| **Path selection** | `kind: "dm"` + 2 participants → P2P. `group_dm` / `channel`, or a 3rd joiner → SFU | Channel calls are joinable at any time, so they never start P2P. Mid-call add on a DM migrates P2P → SFU. |
| **TURN/STUN** | Self-hosted **coturn** | Symmetric NAT and UDP-blocked networks cannot complete P2P. Not a calling SDK. |
| **Recording** | **Out of MVP and v1. v2.** | Requires SFU-side RTP dump, object storage, and a consent banner. Banner copy is reserved in the protocol now (`call.recording-state`) so v2 does not retrofit signaling. |
| **Virtual backgrounds / blur** | **v2.** Client-side MediaPipe Tasks Vision `ImageSegmenter` | No server video processing. Runs in a Web Worker + canvas compositor. |
| **Noise suppression** | **v2.** Constraint-based first; RNNoise WASM as upgrade | Browser `noiseSuppression` constraint is the MVP/v1 fallback; RNNoise for v2. |
| **Call history** | `Message.kind: "call_log"` + `Call` / `CallParticipant` collections | Conversation timeline stays one list. Call documents are the system of record. |
| **One active call per conversation** | Enforced server-side | A second “start” is a join. |
| **Channel names** | `call:{callId}` (exactly one colon) | Engine regex `^[a-z][a-z0-9_-]*:[a-zA-Z0-9_-]{1,128}$` rejects `call:{id}:signaling`. Event names distinguish signaling vs coordination. |
| **Client publish** | Ephemeral only, on `call:{callId}` | Mirrors typing. Durable call lifecycle is server-published on `conv:{id}` and `inbox:{userId}`. |
| **Call UI typefaces** | Existing Pulse fonts: **Hanken Grotesk** (UI), **Space Grotesk** (display), **JetBrains Mono** (timer) | Pulse already shipped these. Introducing Inter only for calls would fork the product. Cyan/amber are **new call-state tokens**, not a second brand. |
| **Call overlay chrome** | Always-dark (`#121212` / `#1E1E1E`) regardless of `prefers-color-scheme` | Calls are a cinematic surface. Chat chrome stays editorial. |
| **Moderator** | Workspace `admin+`, or `Conversation.createdById`, or `Call.initiatedBy` | Pulse has **no channel-owner role**. Mute-others uses this triad. |
| **Package manager** | pnpm, inside `noirly-pulse` | `mediasoup-client` is a Pulse dependency. The SFU is a **separate Node service**, not a Next.js import. |

---

## Table of contents

1. [Executive summary & goals](#1-executive-summary--goals)
2. [Signaling protocol specification](#2-signaling-protocol-specification)
3. [SFU architecture and integration](#3-sfu-architecture-and-integration)
4. [1:1 peer-to-peer call flow](#4-11-peer-to-peer-call-flow)
5. [Group call flow via SFU](#5-group-call-flow-via-sfu)
6. [Advanced features](#6-advanced-features)
7. [Data models](#7-data-models)
8. [State management (CallStore)](#8-state-management-callstore)
9. [Component inventory](#9-component-inventory)
10. [Permissions & device handling](#10-permissions--device-handling)
11. [Design system tokens](#11-design-system-tokens)
12. [Key interaction specs](#12-key-interaction-specs)
13. [Phased build roadmap](#13-phased-build-roadmap)

---

## 1. Executive summary & goals

### 1.1 Why this exists

Pulse is already a self-hosted realtime messenger: Mongo is system truth, noirly-realtime is the fanout bus, clients never publish durable chat. Calling must obey the same philosophy.

A hosted calling platform (Twilio, Daily, Agora, LiveKit Cloud) would:

- Put media and signaling on a vendor network Pulse does not operate
- Duplicate presence, rooms, and auth that noirly-realtime and Identity already provide
- Make DM/channel ACL a second integration instead of `assertConversationAccess`
- Break the “Noirly owns the wire” contract that Identity, Flow, Ledger, and Pulse share

Self-hosting WebRTC with noirly-realtime as the signaling bus keeps one identity, one permission model, one presence system, and one ops story.

### 1.2 Goals

| Goal | Measure |
| --- | --- |
| 1:1 audio and video from any DM | Invite → ring → accept in < 2s on a healthy network; P2P media RTT without an SFU hop |
| Incoming call while Pulse is backgrounded | In-app modal if focused; Web Push + service worker if not; decline/miss written to the DM |
| Group calls in channels | Join/leave without resetting everyone else; grid tiles; active speaker; one presenter |
| Owned media plane | All RTP stays on infrastructure we run (mediasoup + coturn). Signaling stays on noirly-realtime. |
| Graceful failure | Permission denial has recovery UI. ICE failure shows reconnect, then ends the call. Missed calls are durable. |
| Accessible controls | Keyboard mute/camera, live-region join/leave, visible focus on the control bar |

### 1.3 Non-goals by phase

| Phase | In | Out |
| --- | --- | --- |
| **MVP** | 1:1 DM audio/video, ringing, controls, duration, quality indicator, missed-call log, permissions, ICE restart, push for incoming | Group calls, screen share, SFU, backgrounds, noise ML, recording, live captions |
| **v1** | Channel/group_dm SFU calls, join banner, grid, raise hand, mute-others, screen share (one presenter), PiP, reactions, P2P→SFU migration | Recording files, virtual backgrounds, RNNoise, live captions, PSTN/SIP |
| **v2** | MediaPipe blur/background, RNNoise, SFU recording to object storage + consent banner, live captions (Web Speech API) | E2EE media (insertable streams / MLS) — later still |

### 1.4 Why mediasoup (not LiveKit OSS, not a custom SFU)

| Option | Media quality at 8–25 participants | Build complexity | Fit with noirly-realtime |
| --- | --- | --- | --- |
| **Full-mesh P2P** | Collapses past ~4. Each peer encodes N−1 streams. | Low | Fine for 1:1 only |
| **Custom SFU** | Unknown until we reinvent NACK, PLI, GCC, simulcast | Extreme (years) | Hypothetical |
| **LiveKit OSS server** | Excellent (based on Pion / SFU) | Medium if we adopt their client SDK | **Poor.** LiveKit is a full room protocol. Using it means a second WebSocket, second token, second presence — or fighting the SDK to use only the media port. Their cloud is explicitly disallowed; the OSS server still wants to own signaling. |
| **Janus** | Excellent | Medium–high (C plugins, less TS-native) | Neutral, but ops/language mismatch with the Node fleet |
| **mediasoup** | Excellent. Simulcast, AudioLevelObserver, pipe transports, consumer-side layer selection | Medium. We write the thin `noirly-sfu` HTTP API and the Pulse client producer/consumer code | **Best.** mediasoup is a **media router library**. It has no rooms-as-product, no client signaling protocol, no presence. Pulse + noirly-realtime remain the coordination plane. |

**Choice: mediasoup** in a companion Node service (`noirly-sfu`). Pulse talks to it over authenticated HTTP. Browsers send RTP to mediasoup WebRtcTransports. noirly-realtime never sees media.

`mediasoup-client` in the Pulse web app is an OSS protocol adapter for that SFU, not a hosted calling SDK. That is in-policy.

### 1.5 Control plane vs media plane

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER (Pulse)                                                │
│  CallStore · CallOverlay · RTCPeerConnection / mediasoup-client │
└──────────────┬───────────────────────────────┬──────────────────┘
               │ JSON / WSS                    │ UDP/TCP RTP (DTLS-SRTP)
               │ offer/answer/ICE              │ audio / video / display
               ▼                               ▼
     ┌──────────────────┐            ┌─────────────────┐
     │ noirly-realtime  │            │ noirly-sfu      │
     │ :4001 /ws        │  HTTP      │ mediasoup       │
     │ signaling,       │◄──────────►│ workers         │
     │ presence, inbox  │ internal   │ :4002 control   │
     └────────▲─────────┘ publish    │ RTP ports       │
              │                      └────────▲────────┘
              │ REST (create call,            │
              │ ice servers, sfu join)        │
     ┌────────┴─────────┐            ┌────────┴────────┐
     │ noirly-pulse     │            │ coturn          │
     │ Next.js :3004    │            │ STUN/TURN       │
     │ Mongo `calls`    │            └─────────────────┘
     └──────────────────┘
```

**Prose data flow (group call):**

1. Client POSTs `/api/calls` (conversation ACL). Pulse writes `Call` + `CallParticipant`, publishes durable `call.started` on `conv:{conversationId}` and `inbox.call.invite` to members not in the conversation view.
2. Callees subscribe to `call:{callId}` (JWT cap minted with the call id). They POST `/api/calls/:id/join`.
3. Pulse asks `noirly-sfu` to create a router room (if needed) and a WebRtcTransport for this participant. Pulse returns ICE parameters, DTLS parameters, and router RTP capabilities to the client.
4. Client `mediasoup-client` Device loads capabilities, creates send/recv transports, produces mic/camera tracks. SFU notifies Pulse; Pulse (or the SFU via `/internal/publish`) emits `call.participant-joined` and `sfu.consumer-created` so others consume the new producer.
5. Media never traverses noirly-realtime. Signaling and roster do. Presence on `call:{callId}` is the live “who is in the huddle” set.

**1:1 is the same through step 2**, then skips the SFU: clients exchange `webrtc.offer` / `webrtc.answer` / `webrtc.ice-candidate` on `call:{callId}` and send media P2P (or via TURN).

### 1.6 Product principles (calling)

1. **Mongo is call truth. Realtime is coordination. RTP is mediasoup or P2P.** Same triad as chat (Mongo / realtime / React Query), with media as a fourth plane.
2. **Clients never persist call records.** Create/join/leave/end go through REST. Signaling publishes are ephemeral.
3. **A call is scoped to one `conversationId`.** DMs, group DMs, and channels already share that id. There is no parallel “room id” product concept.
4. **`call:{callId}` is `kind:id`.** Extra colons are invalid. Use event names, not nested channel paths.
5. **P2P is an optimization, not a product mode the user picks.** The UI is the same overlay. The store exposes `mediaPath: "p2p" | "sfu"`.

---

## 2. Signaling protocol specification

### 2.1 Channel map (extends `pulseChannel`)

Realtime channel names are `kind:id` with a **single colon**. Add:

```ts
// src/core/realtime/channels.ts
export const pulseChannel = {
  conv: (id: string) => assertChannelName(`conv:${id}`),
  typing: (id: string) => assertChannelName(`ty:${id}`),
  workspace: (id: string) => assertChannelName(`ws:${id}`),
  inbox: (userId: string) => assertChannelName(`inbox:${userId}`),
  call: (callId: string) => assertChannelName(`call:${callId}`),
} as const;
```

| Channel | Publisher | Caps (JWT) | Durability | Purpose |
| --- | --- | --- | --- | --- |
| `call:{callId}` | Clients (signaling, in-call UX) and Pulse/SFU via `/internal/publish` (coordination) | Participants: `subscribe`, `publish`, `presence` | **Ephemeral** (`ephemeral: true`) for client signaling. SFU/Pulse coordination may be ephemeral too — roster is reconstructed from Mongo on join. | Offer/answer/ICE, mute, raise-hand, reactions, present-request, SFU transport messages |
| `conv:{conversationId}` | Pulse server only | `subscribe` (+ `presence` as today) | Durable | `call.started`, `call.ended`, `call.log` (so the open chat sees the banner and history) |
| `inbox:{userId}` | Pulse server only | `subscribe` | Durable | `inbox.call.invite`, `inbox.call.cancelled`, `inbox.call.missed` when the user is not in that conversation view |
| `ws:{workspaceId}` | Pulse server only | `subscribe` | Durable | Optional `call.channel-started` so the workspace rail can show a huddle pip on the channel — v1 |

Do **not** put SDP on `conv:*`. Clients cannot publish there, and replay of offers after the fact is harmful.

### 2.2 JWT caps and token remint

Today `GET /api/realtime/token?workspaceId=&conversationId=` remints when the user navigates, and `useRealtimeScope` recreates the client. A call outlives the conversation view (PiP).

Extend the token query:

```
GET /api/realtime/token?workspaceId=&conversationId=&callId=
```

| Cap | When granted |
| --- | --- |
| `call:{callId}` → `subscribe`, `publish`, `presence` | Session user is a `CallParticipant` with `leftAt == null`, or has a pending invite (`ringing`) for that call |
| Existing conv/ty/ws/inbox caps | Unchanged |

`useRealtimeScope` gains `callId: string | null`. `PulseRealtimeProvider` already recreates the client when scope changes — that remint path covers joining a call without being in the chat.

**Token TTL is 45s.** `RealtimeClient` already refreshes via `getToken()`. In-call signaling must tolerate a reconnect: buffered ICE is flushed after `auth-ok`; an in-flight offer is re-sent if `signalingState` still needs it (see §4.6).

### 2.3 Payload and rate-limit constraints

From noirly-realtime:

| Limit | Value | Calling implication |
| --- | --- | --- |
| Max payload | **32,768 bytes** | SDP (~2–8 KiB) fits. Never attach frames or encoded video. |
| Binary WS frames | **Rejected** | JSON only. |
| Publish / connection / min | **30 default** | Trickle ICE will trip this. **Batch ICE** (see below). Recommend raising `publishPerConnectionPerMin` to **120** on the realtime server when Pulse calling is enabled — document in realtime ops, do not rely on it for correctness. |
| Max subscriptions | **32** | One extra `call:{id}` is fine. |

**ICE batching (mandatory):**

- Collect candidates for **50ms** or until **8** candidates, then publish one `webrtc.ice-batch`.
- Also publish `webrtc.ice-complete` when `iceGatheringState === "complete"`.
- Never one-publish-per-candidate.

### 2.4 Envelope

All client publishes:

```ts
client.publish(pulseChannel.call(callId), event, data, { ephemeral: true });
```

Fan-out is broadcast. **Every payload includes addressing.** Clients ignore events not meant for them.

```ts
interface CallSignalBase {
  callId: string;
  fromUserId: string;
  /** If set, only this user applies the event. Omit for room-wide. */
  toUserId?: string;
  /** Monotonic per sender, for drop/reorder detection. */
  seq: number;
  occurredAt: number;
}
```

### 2.5 Event catalog

#### 2.5.1 Client → `call:{callId}` (ephemeral)

| Event | When | `data` |
| --- | --- | --- |
| `webrtc.offer` | P2P: caller (or offerer after glare resolve) | `{ sdp: string, mediaPath: "p2p" }` |
| `webrtc.answer` | P2P: callee | `{ sdp: string }` |
| `webrtc.ice-batch` | P2P trickle | `{ candidates: RTCIceCandidateInit[] }` |
| `webrtc.ice-complete` | Gathering done | `{ }` |
| `webrtc.ice-restart-offer` | Reconnect | `{ sdp: string }` |
| `sfu.transport-ice` | SFU: ICE on a WebRtcTransport (if not using mediasoup HTTP ICE) | `{ transportId: string, candidate: RTCIceCandidateInit }` — prefer connecting transports via Pulse REST to avoid publish storms; see §3.4 |
| `call.mute-state` | Local mic/camera toggled | `{ isMuted: boolean, isVideoOn: boolean }` |
| `call.speaking` | Optional client-side VAD fallback (P2P) | `{ level: number }` — throttle 200ms; SFU uses AudioLevelObserver instead |
| `call.raise-hand` | Toggle | `{ raised: boolean }` |
| `call.reaction` | Emoji burst | `{ emoji: string, ttlMs?: number }` |
| `call.present-request` | Want screen | `{ }` |
| `call.present-release` | Stopped sharing | `{ }` |
| `call.quality` | Optional stats sample for UI | `{ packetLoss: number, rttMs: number, jitterMs: number }` — local only unless debugging |

#### 2.5.2 Pulse server → `conv:{conversationId}` (durable)

| Event | After Mongo write | `data` |
| --- | --- | --- |
| `call.started` | Call created | `{ call: CallPublic }` |
| `call.updated` | Status/path/presenter change | `{ call: CallPublic }` |
| `call.ended` | Terminal status | `{ call: CallPublic, logMessage: Message }` |
| `call.participant-joined` | Participant row | `{ callId, participant: CallParticipantPublic }` |
| `call.participant-left` | `leftAt` set | `{ callId, userId, reason: LeaveReason }` |

Clients patch React Query conversation + a `qk.call(conversationId)` cache. The in-call overlay prefers CallStore (live) over this.

#### 2.5.3 Pulse server → `inbox:{userId}` (durable)

| Event | Meaning |
| --- | --- |
| `inbox.call.invite` | Incoming ring. Payload: `{ callId, conversationId, conversationKind, initiatedBy, type, workspaceId }` |
| `inbox.call.cancelled` | Caller hung up during ring |
| `inbox.call.missed` | Ring timed out (no accept). Also creates the call-log message. |

Web Push uses the same payload shape (`title`, `body`, `url` deep link to `/dm/:id` or `/w/:ws/channel/:id?call=:callId`).

#### 2.5.4 Pulse or SFU → `call:{callId}` (ephemeral coordination)

| Event | Publisher | `data` |
| --- | --- | --- |
| `sfu.router-rtp-capabilities` | Pulse after join (usually returned over REST; event is a refresh) | `{ routerRtpCapabilities }` |
| `sfu.new-producer` | SFU → realtime | `{ producerId, userId, kind: "audio" \| "video", source: TrackSource }` |
| `sfu.producer-closed` | SFU | `{ producerId, userId }` |
| `sfu.active-speaker` | SFU AudioLevelObserver, throttle 300ms | `{ userId: string \| null, level: number }` |
| `call.path-changed` | Pulse, P2P → SFU migration | `{ mediaPath: "sfu", reason: "participant-added" \| "kind-changed" }` |
| `call.presenter-changed` | Pulse | `{ userId: string \| null }` |
| `call.recording-state` | Pulse (v2; reserved) | `{ recording: boolean }` |
| `call.moderation.mute` | Pulse after REST | `{ targetUserId, isMuted: true, byUserId }` |
| `call.ended` | Pulse (fast path so overlay closes before conv replay) | `{ reason: EndReason }` |

#### 2.5.5 Presence on `call:{callId}`

Join payload (replace, not merge — same as chat):

```ts
interface CallPresenceData {
  displayName: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isVideoOn: boolean;
  isPresenting: boolean;
  handRaised: boolean;
  mediaPath: "p2p" | "sfu";
}
```

Use `usePresence(pulseChannel.call(callId), { collapseByUserId: true })`. This is the live roster. Mongo `CallParticipant` is the durable roster for logs and late join.

### 2.6 TypeScript message schemas (canonical)

Place in `src/core/calls/protocol.ts`. Zod at the REST boundary; these interfaces are the WS contract.

```ts
export type CallType = "audio" | "video";
export type MediaPath = "p2p" | "sfu";
export type TrackSource = "mic" | "camera" | "screen";
export type LeaveReason = "hangup" | "kicked" | "timeout" | "migrate" | "error";
export type EndReason = "hangup" | "timeout" | "failed" | "replaced";

export type CallSignalEvent =
  | "webrtc.offer"
  | "webrtc.answer"
  | "webrtc.ice-batch"
  | "webrtc.ice-complete"
  | "webrtc.ice-restart-offer"
  | "call.mute-state"
  | "call.speaking"
  | "call.raise-hand"
  | "call.reaction"
  | "call.present-request"
  | "call.present-release";

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
  ttlMs: number; // default 2500
}

export interface InboxCallInviteData {
  callId: string;
  conversationId: string;
  conversationKind: "dm" | "group_dm" | "channel";
  workspaceId: string | null;
  initiatedBy: string;
  initiatedByName: string;
  type: CallType;
  ringTimeoutMs: number; // 30000
}
```

### 2.7 Addressing and glare

- **P2P 1:1:** `toUserId` is always the other participant. Filter on receive.
- **Glare:** both sides may call `createOffer` if they hit Accept simultaneously. Use the **lower `userId` (hex ObjectId) as polite peer**: the polite peer rolls back (`signalingState === "have-local-offer"` → `setLocalDescription(null)` / abort) and applies the remote offer (Perfect Negotiation, W3C).
- **Group:** most events are room-wide (`toUserId` omitted). SFU new-producer is room-wide; each client creates a consumer via REST, not via SDP offer/answer on the bus.

### 2.8 What is not a realtime event

| Action | Transport |
| --- | --- |
| Create call, accept, decline, end, join, leave | REST — must ACL and persist |
| Mint TURN credentials | REST `GET /api/calls/ice` |
| SFU join (router caps, transports) | REST `POST /api/calls/:id/sfu/join` |
| Moderator mute | REST `POST /api/calls/:id/participants/:userId/mute` then fanout |
| Grant presenter | REST `POST /api/calls/:id/presenter` |

REST then publishes. The overlay may optimistic-update CallStore, then reconcile.

---

## 3. SFU architecture and integration

### 3.1 Service topology

New service **`noirly-sfu`** (recommended as its own repo, mirroring `noirly-realtime`):

| Process | Role |
| --- | --- |
| `noirly-pulse` | ACL, Mongo, JWT, HTTP BFF to SFU, durable events |
| `noirly-realtime` | Signaling + presence + inbox |
| `noirly-sfu` | mediasoup Workers / Routers / Transports / Producers / Consumers |
| `coturn` | STUN/TURN for P2P and as ICE for mediasoup `announcedIp` |

Do **not** embed mediasoup inside the Next.js process (libuv + worker threads + UDP ports fight serverless/multi-instance Pulse). Do **not** embed it inside noirly-realtime (different scale axis: CPU/UDP vs fanout/Redis).

### 3.2 mediasoup mapping

| mediasoup object | Pulse concept |
| --- | --- |
| Worker (1 per CPU, typically) | Process pool in `noirly-sfu` |
| Router | One per **active Call** (`router.appData.callId`) |
| WebRtcTransport | Two per participant: send + recv (or one bidirectional; two is clearer) |
| Producer | One per track (`mic`, `camera`, `screen`) |
| Consumer | Per (viewer, producer) pair on the recv transport |
| AudioLevelObserver | One per router → `sfu.active-speaker` |
| DirectTransport / pipe | Multi-node later (v2 scale-out) |

**Codecs (router `mediaCodecs`):**

- Audio: Opus, 48000, 2 channels, `useinbandfec=1`
- Video: VP8 (baseline, simulcast-friendly) + H264 `profile-level-id 42e01f` for Safari. Prefer VP8 for simulcast layers.

### 3.3 Deployment model

**Local / staging**

```
noirly-sfu:
  MEDIASOUP_LISTEN_IP=0.0.0.0
  MEDIASOUP_ANNOUNCED_IP=<host LAN IP or public>
  MEDIASOUP_RTC_MIN_PORT=40000
  MEDIASOUP_RTC_MAX_PORT=40100
  PULSE_SFU_SHARED_SECRET=...
  REALTIME_INTERNAL_URL=http://127.0.0.1:4001
  REALTIME_INTERNAL_SECRET=...
  PORT=4002
```

**Production**

- VM or k8s **DaemonSet / Deployment with hostNetwork or NodePort UDP range 40000–40100** (or a single node pool labeled `sfu=true`).
- `announcedIp` = public IPv4 (and IPv6 when available).
- TLS is not on RTP; DTLS is inside WebRTC. Control plane `noirly-sfu` HTTP is **private** (Pulse → SFU on an internal network). Browsers never call `noirly-sfu` HTTP; they only hit UDP/TCP on the announced ICE addresses returned in transport parameters.
- Horizontal scale v1: **one SFU instance** (sticky by call — all participants of a call on one router). v2: pipe transports / Redis call→worker map.

**coturn**

- `listening-port=3478`, TLS 5349
- Time-limited credentials: Pulse `GET /api/calls/ice` HMAC-signs `username = expiry:userId` with `TURN_SECRET` (coturn `use-auth-secret`).
- `realm=pulse.noirly`
- Relay only to mediasoup/P2P peers; do not open as an open relay.

### 3.4 Split of responsibilities

| Concern | Owner |
| --- | --- |
| Who may join | Pulse (`assertConversationAccess`, participant row) |
| Ring / miss / log message | Pulse |
| SDP offer/answer (P2P only) | Clients via `call:{id}` |
| Router create/destroy | Pulse → SFU HTTP `POST /internal/rooms` `DELETE /internal/rooms/:callId` |
| Transport / produce / consume | Client ↔ Pulse BFF ↔ SFU (see §3.5) |
| Active speaker | SFU observer → realtime publish |
| Simulcast layer | Client `consumer.setPreferredLayers` via BFF, or SFU based on `spatialLayer` hint |
| Presence roster | noirly-realtime presence on `call:{id}` |
| TURN credentials | Pulse + coturn |

**SFU does not authenticate end users with OIDC.** Pulse authenticates the user, then calls SFU with `PULSE_SFU_SHARED_SECRET` and `{ callId, userId }`. The browser receives opaque transport ids and ICE parameters; it cannot create a room for a conversation it does not belong to.

### 3.5 SFU HTTP API (internal, Pulse-only)

```
POST   /internal/rooms                    { callId } → { routerRtpCapabilities }
DELETE /internal/rooms/:callId
POST   /internal/rooms/:callId/transports { userId, direction: "send"|"recv" }
                                         → { transportId, iceParameters, iceCandidates, dtlsParameters }
POST   /internal/rooms/:callId/transports/:id/connect { dtlsParameters }
POST   /internal/rooms/:callId/producers  { userId, transportId, kind, rtpParameters, source }
                                         → { producerId }
POST   /internal/rooms/:callId/consumers  { userId, producerId, rtpCapabilities }
                                         → { consumerId, kind, rtpParameters, producerPaused }
POST   /internal/rooms/:callId/consumers/:id/resume
POST   /internal/rooms/:callId/consumers/:id/layers { spatialLayer, temporalLayer }
POST   /internal/rooms/:callId/producers/:id/pause | /resume
```

Pulse exposes thin user-facing routes:

```
POST /api/calls/:id/sfu/join
POST /api/calls/:id/sfu/transport
POST /api/calls/:id/sfu/transport/:transportId/connect
POST /api/calls/:id/sfu/produce
POST /api/calls/:id/sfu/consume
POST /api/calls/:id/sfu/consumer/:consumerId/resume
POST /api/calls/:id/sfu/consumer/:consumerId/layers
```

This keeps mediasoup types out of the browser’s trust boundary and lets Pulse audit produce/consume.

**ICE for SFU transports:** use the ICE candidates mediasoup returns in `iceCandidates` (server-reflexive / host as configured). Additional trickle via realtime is optional; mediasoup typically gathers on the server side.

### 3.6 Media routing flow (group)

1. Alice POSTs join → Pulse ensures room → SFU creates router if missing.
2. Alice creates send transport, connect (DTLS), produce mic + camera (camera omitted for audio-only).
3. SFU emits `sfu.new-producer` on `call:{id}` (via realtime internal publish).
4. Bob (already in call) receives the event → POST consume → `recvTransport.consume` → `consumer.resume`.
5. When Alice leaves, Pulse closes her transports; SFU closes producers; others get `sfu.producer-closed` and drop the tile.
6. **No SDP renegotiation across the group.** Each produce/consume is independent. That is the point of the SFU vs full-mesh.

### 3.7 Simulcast and bandwidth adaptation

**Send (camera):** `mediasoup-client` produce with three encodings:

| RID | Max bitrate | Scale |
| --- | --- | --- |
| `q` | 150 kbps | 4 |
| `h` | 500 kbps | 2 |
| `f` | 1200 kbps | 1 |

Screen share: **single high layer** (no simulcast) — text must stay sharp. Cap ~1.5–2.5 Mbps. Audio: one Opus producer, DTX on.

**Receive:** Pulse/CallStore maps tile size → preferred spatial layer:

| Tile | Spatial |
| --- | --- |
| PiP / 1 of ≥9 | 0 (`q`) |
| Grid 3–8 | 1 (`h`) |
| Spotlight / presenter / 1–2 tiles | 2 (`f`) |

On `RTCOutboundRtpStreamStats` / consumer score (mediasoup `consumer.on("score")`), drop a layer if `score < 5` for 2s; climb slowly.

**Why this does not degrade the room:** each consumer has its own layers. A weak network pauses or downshifts **that viewer’s** consumers; Alice’s encoder still sends simulcast; the SFU forwards what Bob asked for.

**P2P 1:1:** no simulcast required. Use `getStats()` to set `RTCRtpSender.setParameters` `encodings[0].maxBitrate` (video 800–1800 kbps) and show the quality indicator. `degradationPreference: "maintain-framerate"` for camera, `"maintain-resolution"` for screen (v1, P2P screen-share if ever allowed — v1 screen share is SFU-only).

### 3.8 Active speaker

mediasoup `AudioLevelObserver` on all audio producers, interval 300ms, threshold `-70 dBov`. SFU publishes `sfu.active-speaker`. CallStore sets `activeSpeakerUserId`. Tiles use this for the cyan ring (not client-side analysers in group mode — those disagree across machines).

P2P: local `AnalyserNode` on the remote audio track, same ring UI.

### 3.9 Relationship to noirly-realtime (non-negotiable)

- noirly-realtime **does not** terminate DTLS, does not allocate UDP, does not inspect RTP.
- SFU **does not** mint user JWTs, does not know conversation ACL, does not store call history.
- The only coupling is `POST /internal/publish` (SFU → realtime) and Pulse as the BFF (Pulse → SFU).
- A realtime outage: **in-progress RTP continues** until ICE/DTLS dies; new joins fail; mute-state events pause. UI shows the existing `ConnectionBanner` plus a call-specific reconnect chip. A SFU outage: group calls fail; 1:1 P2P is unaffected.

---

## 4. 1:1 peer-to-peer call flow

Applies when `Conversation.kind === "dm"` and the call has two participant slots. `mediaPath: "p2p"`.

### 4.1 Preconditions

- Caller is a conversation member (`assertConversationAccess`).
- Callee is a member (the other DM user).
- No other `Call` for this `conversationId` in `status ∈ { ringing, connecting, active }`.
- Browser: we need mic (always) and camera (if `type === "video"`).

### 4.2 Sequence

```
Caller                         Pulse / Mongo              Realtime                 Callee
  │ POST /api/calls               │                         │                        │
  │ { conversationId, type }      │                         │                        │
  │──────────────────────────────►│ insert Call ringing     │                        │
  │                               │ insert participants     │                        │
  │                               │ insert? (no log yet)    │                        │
  │                               │ publish conv call.started                         │
  │                               │ publish inbox.call.invite ───────────────────────►│
  │                               │                         │                        │ ring UI + push
  │◄──── { call, iceServers }     │                         │                        │
  │ getUserMedia                  │                         │                        │
  │ subscribe call:{id}           │                         │                        │
  │ presence join                 │                         │                        │
  │                               │                         │                        │ POST /api/calls/:id/accept
  │                               │                         │                        │ getUserMedia
  │                               │ status connecting       │                        │
  │                               │                         │  call.participant-joined
  │ createOffer                   │                         │                        │
  │ publish webrtc.offer ────────────────────────────────────────────────────────────►│
  │                               │                         │                        │ setRemoteDescription
  │                               │                         │                        │ createAnswer
  │◄────────────────────────────────────────────────────────── webrtc.answer         │
  │ setRemoteDescription          │                         │                        │
  │ ice-batch ◄──────────────────►│                         │◄──── ice-batch ───────►│
  │ connected                     │                         │                        │
  │ POST /api/calls/:id/connected │ status active, startedAt│                        │
```

`GET /api/calls/ice` may be bundled in the create/accept responses as `iceServers`.

### 4.3 Offer/answer/ICE details

1. `RTCPeerConnection({ iceServers, bundlePolicy: "max-bundle", iceCandidatePoolSize: 2 })`.
2. Add tracks from the local `MediaStream` **before** `createOffer` (renegotiation-friendly).
3. `offerToReceiveAudio: true`, `offerToReceiveVideo: type === "video"` (audio-only still creates a recv transceiver for a later camera upgrade).
4. Caller `setLocalDescription(offer)` then publish. Do not wait for ICE complete (trickle).
5. Callee `setRemoteDescription(offer)` → `createAnswer` → `setLocalDescription(answer)` → publish.
6. Apply `webrtc.ice-batch` with `addIceCandidate`. Queue candidates that arrive before remote description (standard).
7. `connectionState === "connected"` → both sides POST `/connected` (idempotent). First writer sets `status: "active"`, `startedAt`.

**Camera off in a video call:** replace camera track with a disabled sender (`sender.replaceTrack(null)` or `track.enabled = false`). Signal `call.mute-state`. Do not remove the transceiver if you want a fast unmute.

**Upgrade audio → video mid-call:** `addTrack` + `createOffer` (Perfect Negotiation). Still P2P.

### 4.4 Ring, accept, decline, miss

| User action | REST | Result |
| --- | --- | --- |
| Accept | `POST /api/calls/:id/accept` | Participant `joinedAt` set; status `connecting` |
| Decline | `POST /api/calls/:id/decline` | Call `status: "ended"`, `endReason: "declined"`; call-log message `missed` for caller, `declined` internally; `inbox.call.cancelled` |
| Ignore until timeout (30s) | Pulse job or accept-route lazy expire | `status: "missed"`; call-log `missed`; push already sent |
| Caller cancels | `POST /api/calls/:id/end` | `inbox.call.cancelled`; no missed log (or log `cancelled` — prefer **cancelled**, not missed) |

**Online gating:** if callee has no presence on `conv:{id}` **and** `User.lastSeenAt` older than 2 minutes **and** no Pulse heartbeat, still ring via **Web Push**. Do not block the call. Presence is a hint for UI (“likely online”), not a hard gate. If push is denied, the inbox event still lands when they next have a tab.

### 4.5 Call controls (MVP)

| Control | Implementation |
| --- | --- |
| Mute / unmute mic | `audioTrack.enabled = false/true` + `call.mute-state` + presence update |
| Camera on/off | `videoTrack.enabled` or `replaceTrack` + same |
| End | `POST /end`, close PC, stop tracks, leave presence |
| Switch camera | `getUserMedia({ video: { deviceId: { exact }, facingMode } })` → `replaceTrack` |
| Device selection | `enumerateDevices` after permission; `setSinkId` on the remote `<audio>` where supported |
| Duration | `Date.now() - startedAt`, JetBrains Mono |
| Quality | `getStats()` every 2s: inbound `packetsLost / packetsReceived`, `jitter`, selected candidate pair RTT. Map to `good \| ok \| poor` (see §10.5) |

### 4.6 ICE restart and signaling reconnect

**Media (ICE):**

1. `connectionState` `disconnected` → show reconnect banner, start 8s timer.
2. `failed` or timer fire → `pc.restartIce()` + Perfect Negotiation offer (`webrtc.ice-restart-offer`).
3. If still failed after **20s**, POST `/end` with `endReason: "failed"`.

**Signaling (realtime):**

- On `reconnecting`, do not tear down `RTCPeerConnection`.
- On `ready`, re-`presenceJoin`, re-subscribe `call:{id}` (no replay of ephemeral offers).
- If `signalingState` is unstable, run ICE restart.

### 4.7 Cleanup

On end, unmount, or `beforeunload`:

1. `peerConnection.close()`
2. Local stream tracks `stop()`
3. `presenceLeave`
4. Clear CallStore media refs (see §8)
5. `devicechange` listener removed

Never leave `getUserMedia` tracks alive in PiP-minimized state **except** the tracks still attached to the PC (PiP keeps the call).

---

## 5. Group call flow via SFU

Applies when `kind ∈ { group_dm, channel }` **or** a DM call migrates (§12.2). `mediaPath: "sfu"`.

### 5.1 Start and join banner

- Any member with `message.send` can `POST /api/calls` on that conversation.
- Pulse sets `mediaPath: "sfu"`, creates SFU room.
- Durable `call.started` on `conv:{id}` drives **ChannelCallBanner** (“Call in progress — Join”) in `ChatView` / channel header.
- Members already in the conversation view do not need inbox ring if the product choice is **huddle-style** (opt-in join, no ringing everyone). **Locked product rule:**

| Conversation | Notify |
| --- | --- |
| `dm` | Ring the other person (modal + push) |
| `group_dm` | Ring all other members (same as DM, 30s) — group DMs are small |
| `channel` | **No ring.** Banner + optional quiet inbox event if prefs `=== "all"`. Push only if the user enabled “calls in this channel” (reuse `NotificationPref`; v1 treats `all` as banner+push, `mentions`/`none` as banner only when the channel is open) |

### 5.2 Join / leave (no room reset)

**Join:**

1. `POST /api/calls/:id/join` (idempotent if already in).
2. `POST /sfu/join` → capabilities + existing producer list.
3. Device.load → create transports → produce local tracks.
4. For each existing producer, consume + resume.
5. Presence join. Others see a new tile (Framer Motion layout).

**Leave:**

1. `POST /leave` (call continues if `participantCount > 0`).
2. Close local transports; SFU closes producers; others drop consumers.
3. If last participant, Pulse ends the call and closes the router.

Kicking / host end: `POST /end` as initiator or moderator ends for everyone.

### 5.3 Grid and active speaker

- Tile count `n` → CSS grid: 1 → spotlight; 2 → split; 3–4 → 2×2; 5–9 → 3×3; 10+ → 4×N with scroll. Presenter (screen) takes **large pane**; others strip along the side (see §12.3).
- `activeSpeakerUserId` from SFU. Highlight even if not presenting.
- Self view: always a small mirrored tile (`scaleX(-1)` for camera, **not** for screen).

### 5.4 Raise hand and mute-others

- `call.raise-hand` ephemeral + presence `handRaised`. Moderator list sorts raised-first.
- Mute-others: REST (ACL) → SFU `producer.pause()` on that user’s audio → `call.moderation.mute` → target CallStore forces `isMuted: true` and `audioTrack.enabled = false`. They can unmute themselves unless a future “mute lock” is added (out of v1).

**Who is moderator:** `can("message.moderate")` (admin+) **or** `conversation.createdById === me` **or** `call.initiatedBy === me`.

### 5.5 Renegotiation

There is no whole-room SDP. Adding a camera mid-call is an extra `produce`. Stopping camera is `producer.close`. Screen share is a third producer with `source: "screen"`.

### 5.6 Channel member vs call participant

Public channels can have large membership. **Do not** create `CallParticipant` rows for everyone on start. Rows exist for **joined** users (and for DM/group_dm, ringing invitees with `joinedAt: null` until accept).

---

## 6. Advanced features

### 6.1 Screen sharing (v1)

**API:** `navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: true })`. Surface picker is the **browser** picker (full screen / window / tab). Pulse does not reimplement a picker UI beyond a “Share screen” button and Safari caveats. `ScreenSharePicker` in the inventory is a **thin wrapper**: permission copy, “you are presenting” chip, stop button — not a fake window list (the spec cannot enumerate windows).

**One presenter:**

- `Call.presenterUserId: string | null`
- Second share attempt → if null, REST `POST /presenter` (first-wins). If set, send `call.present-request`; presenter or moderator `POST /presenter` to transfer (see §12.3).
- Queue: CallStore `presentQueue: userId[]`. UI shows “X wants to present”.

**Tile treatment:** presenting tile uses `source: "screen"`, no mirror, “PRESENTING” mono label, cyan hairline. Camera of the presenter stays a small PIP inside that tile or in the strip.

**P2P:** screen share is **not** in MVP. v1 screen share requires SFU. If a 1:1 DM wants screen share, **migrate to SFU first** (same path as adding a third person, without adding a person): `POST /api/calls/:id/upgrade-sfu` then produce screen. This keeps one screen-share implementation.

**Ended share:** `ended` event on the display track → `present-release` + REST clear presenter + close producer.

### 6.2 Virtual backgrounds / blur (v2)

**Approach:** client-side segmentation. **Library: MediaPipe Tasks Vision `ImageSegmenter`** with the selfie segmenter model (`selfie_segmenter.tflite` / `.task`), WASM delegate, running in a **Web Worker**.

Pipeline:

1. Camera `MediaStreamTrack` → `OffscreenCanvas` in worker (or `Canvas` + `requestVideoFrameCallback` on main thread if worker+OffscreenCanvas is unsupported).
2. Segmenter output mask.
3. Composite: blur (`ctx.filter = blur(12px)` of downscaled frame) or replace with an image.
4. `canvas.captureStream(24)` → processed track → `replaceTrack` on the camera sender/producer.

**Why MediaPipe Tasks vs `@mediapipe/selfie_segmentation`:** the older selfie_segmentation package is deprecated in favor of Tasks. New code should use `@mediapipe/tasks-vision`.

**Why not server-side:** would ship raw video to our SFU for ML — cost, privacy, latency. Out of policy for this feature.

**Fallback:** if WASM/WebGL fails, disable the toggle and keep the raw camera. Never block joining.

**CPU:** default **blur**, 24 fps, mask at ≤640px on the long edge. Full virtual background images are opt-in.

**Not in MVP/v1** so the overlay can ship without a 5–10 MB model download on first call.

### 6.3 Noise suppression

| Phase | Approach | Support |
| --- | --- | --- |
| MVP / v1 | `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })` | Chromium/Firefox/Safari all implement these constraints to varying quality. Safari AGC is weaker — accept it. |
| v2 | RNNoise via WASM (`@sapphi-red/web-noise-suppressor` or an in-repo RNNoise build) as an **AudioWorklet** inserted between mic and `MediaStreamAudioDestinationNode`, then use that stream’s track | Chromium + Firefox. Safari AudioWorklet is OK; if RNNoise SIMD fails, fall back to constraints. |

**Do not** rely on non-standard `RTCAudioSource`. Use constraints + optional Worklet.

**Noise gate (optional v2):** AnalyserNode RMS; if below threshold for 200ms, `track.enabled = false` locally (VAD mute). Can clip quiet speech — default **off**.

### 6.4 Recording (v2, not MVP)

**Architecture (when built):**

- mediasoup `PlainTransport` or RTP observers → FFmpeg/GStreamer sidecar muxes Opus+VP8 to fragmented MP4.
- Upload to object storage (same pattern as Pulse uploads, new bucket prefix `calls/{callId}/`).
- `Call.recording: boolean`, `recordingStartedAt`.
- On start: durable `call.recording-state` + **non-dismissible banner** “This call is being recorded” on every overlay. Consent is **notice + leave**, not a legal clickwrap (product/legal can tighten later).
- 1:1 P2P recording would require a recording bot joining via SFU — **another reason 1:1 upgrades to SFU** if recording is enabled.

**MVP/v1:** do not show a recording button. Reserve the event name and banner component so v2 does not redesign the overlay.

### 6.5 In-call reactions (v1)

- `call.reaction` ephemeral `{ emoji, ttlMs: 2500 }`.
- Overlay: emoji floats up from the sender’s tile (Framer Motion, 3–4 in flight max per tile).
- Not persisted. Not a chat `reaction.added`. Distinct from message reactions.
- Palette: reuse a small subset of the chat emoji list (👍 ❤️ 😂 🎉 👋 👎).

### 6.6 Live captions (v2 candidate)

Web Speech API `SpeechRecognition` on the **local** mic only is easy and not a transcript of others. Real captions need either:

- Per-peer recognition (each client captions their own audio and sends text on `call:{id}`), or
- SFU audio fork to a STT worker.

Document as v2: **local-caption-broadcast** (each peer sends partial transcripts as ephemeral `call.caption`). ARIA live polite. Not in MVP/v1.

---

## 7. Data models

### 7.1 Enums (`src/core/models/enums.ts` additions)

```ts
export const CALL_TYPES = ["audio", "video"] as const;
export type CallType = (typeof CALL_TYPES)[number];

export const CALL_STATUSES = [
  "ringing",
  "connecting",
  "active",
  "ended",
  "missed",
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_MEDIA_PATHS = ["p2p", "sfu"] as const;
export type CallMediaPath = (typeof CALL_MEDIA_PATHS)[number];

export const CALL_END_REASONS = [
  "hangup",
  "declined",
  "timeout",
  "failed",
  "replaced",
] as const;
export type CallEndReason = (typeof CALL_END_REASONS)[number];

export const MESSAGE_KINDS = ["user", "call_log"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const CALL_LOG_KINDS = [
  "started",
  "ended",
  "missed",
  "cancelled",
  "declined",
] as const;
export type CallLogKind = (typeof CALL_LOG_KINDS)[number];

export const NOTIFICATION_KINDS = [
  "mention",
  "dm",
  "thread_reply",
  "incoming_call",
  "missed_call",
] as const;
```

### 7.2 Domain interfaces (`src/core/models/types.ts`)

```ts
export interface Call {
  id: string;
  conversationId: string;
  workspaceId: string | null;
  initiatedBy: string;
  type: CallType;
  status: CallStatus;
  mediaPath: CallMediaPath;
  presenterUserId: string | null;
  recording: boolean; // always false until v2
  startedAt: string | null; // set when status → active
  endedAt: string | null;
  endReason: CallEndReason | null;
  ringTimeoutMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface CallParticipant {
  id: string;
  callId: string;
  userId: string;
  joinedAt: string | null; // null = invited / ringing
  leftAt: string | null;
  isMuted: boolean;
  isVideoOn: boolean;
  isPresenting: boolean;
  handRaised: boolean;
  role: "host" | "guest"; // host = initiatedBy at insert time
  createdAt: string;
  updatedAt: string;
}

export interface CallLogPayload {
  callId: string;
  logKind: CallLogKind;
  type: CallType;
  durationSeconds: number | null;
  initiatedBy: string;
  mediaPath: CallMediaPath;
}

export interface CallPublic extends Call {
  participants: CallParticipantPublic[];
}

export interface CallParticipantPublic extends CallParticipant {
  displayName: string;
  avatarUrl: string | null;
}
```

### 7.3 Message extension

```ts
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  kind: MessageKind; // default "user"
  content: string;   // call_log: human fallback, e.g. "Missed video call"
  callLog: CallLogPayload | null;
  // ...existing fields
}
```

- `kind: "call_log"` messages: `senderId` = `initiatedBy` (or system user — prefer initiator so avatars work).
- `content` is a plaintext fallback for search and notifications.
- `threadParentId` always `null`. No reactions on call logs in MVP (can allow later).
- Mapper: existing `message.sent` fanout; `MessageBubble` branches on `kind`.

**Do not** create a separate `CallLogEntry` collection. The user-facing “CallLogEntry” **is** a `Message` with `kind: "call_log"`. The name in APIs:

```ts
/** @alias Message with kind === "call_log" */
export type CallLogEntry = Message & {
  kind: "call_log";
  callLog: CallLogPayload;
};
```

This keeps one timeline, one pagination cursor, one search index.

### 7.4 Mongo collections

| Collection | Indexes |
| --- | --- |
| `calls` | `{ conversationId, status }`, `{ conversationId, createdAt }`, unique partial `{ conversationId }` where status in ringing/connecting/active — **partial unique index** to enforce one live call |
| `call_participants` | unique `{ callId, userId }`, `{ userId, leftAt }` |

Mongoose models: `src/server/models/Call.ts`, `CallParticipant.ts`.

### 7.5 REST API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/calls` | Create + ring/banner. Body: `{ conversationId, type, clientNonce }` |
| `GET` | `/api/calls/:id` | Snapshot for late UI |
| `GET` | `/api/conversations/:id/call` | Active call for banner (`null` if none) |
| `POST` | `/api/calls/:id/accept` | DM/group_dm callee |
| `POST` | `/api/calls/:id/decline` | |
| `POST` | `/api/calls/:id/join` | Channel / already-active |
| `POST` | `/api/calls/:id/leave` | |
| `POST` | `/api/calls/:id/connected` | P2P both sides; first wins `active` |
| `POST` | `/api/calls/:id/end` | |
| `POST` | `/api/calls/:id/upgrade-sfu` | 1:1 screen share or 3rd participant |
| `POST` | `/api/calls/:id/presenter` | `{ userId }` grant/clear |
| `POST` | `/api/calls/:id/participants/:userId/mute` | Moderator |
| `GET` | `/api/calls/ice` | `{ iceServers: RTCIceServer[] }` |
| `POST` | `/api/calls/:id/sfu/*` | §3.5 |

`clientNonce` on create: idempotent retries.

### 7.6 `PulseSyncProvider` extensions

Add methods matching the table above. Implement in `mongo-sync-provider.ts`. After writes, `publishRealtime` on `conv:*` / `inbox:*` as specified.

### 7.7 Permissions

| Action | Rule |
| --- | --- |
| Start call | `assertConversationAccess` + `message.send` equivalent (member who can send) |
| Join | Same access + call `status` in `connecting \| active` (channel) or invitee (dm) |
| End for all | Moderator triad (§5.4) or last participant leave |
| Mute other | Moderator triad |
| Present | Any joined participant if no presenter; else grant |

New `PermissionAction` optional: `call.moderate` mapped like `message.moderate`. Prefer reusing `message.moderate` to avoid RBAC sprawl.

---

## 8. State management (CallStore)

### 8.1 Placement and rules

- **New file:** `src/stores/call-store.ts` (do not dump this into `ui-store.ts` — call state is large and has media refs).
- **Still Zustand.** React Query holds `CallPublic` snapshots (`qk.activeCall(conversationId)`, `qk.call(callId)`). CallStore holds **session** state: FSM, local streams, PC/device refs, ephemeral reactions.
- **Never clone message history into CallStore.**
- Media objects (`MediaStream`, `RTCPeerConnection`, `mediasoup.Device`) live in a **ref module** (`src/features/calls/media-session.ts`) so Zustand stays JSON-debuggable. Store holds ids + flags; the session object is a singleton per `callId`.

### 8.2 Session singleton

```ts
// src/features/calls/media-session.ts
export type MediaSession = {
  callId: string;
  path: MediaPath;
  pc: RTCPeerConnection | null;
  device: import("mediasoup-client").types.Device | null;
  sendTransport: mediasoup.types.Transport | null;
  recvTransport: mediasoup.types.Transport | null;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  producers: Map<TrackSource, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>; // producerId → consumer
  remoteStreams: Map<string, MediaStream>; // userId → combined
  iceTimer: ReturnType<typeof setTimeout> | null;
  statsTimer: ReturnType<typeof setInterval> | null;
  iceBuffer: RTCIceCandidateInit[];
};

let session: MediaSession | null = null;
export function getMediaSession(): MediaSession | null;
export function replaceMediaSession(next: MediaSession | null): void;
```

Zustand must not store `MediaStream` directly (no persistence, hard to reset). Components read streams via `getMediaSession()`.

### 8.3 Store shape

```ts
export type CallUiStatus =
  | "idle"
  | "requesting-media"
  | "ringing-out"
  | "ringing-in"
  | "connecting"
  | "active"
  | "reconnecting"
  | "ending";

export type ConnectionQuality = "good" | "ok" | "poor" | "unknown";

export type CallLayoutMode = "overlay" | "pip";

export interface CallPeerState {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isVideoOn: boolean;
  isPresenting: boolean;
  handRaised: boolean;
  speaking: boolean;
  joined: boolean;
}

export interface IncomingInvite {
  callId: string;
  conversationId: string;
  conversationKind: ConversationKind;
  workspaceId: string | null;
  initiatedBy: string;
  initiatedByName: string;
  type: CallType;
  ringDeadline: number;
}

export interface CallStore {
  status: CallUiStatus;
  callId: string | null;
  conversationId: string | null;
  mediaPath: MediaPath | null;
  type: CallType | null;
  layout: CallLayoutMode;
  startedAt: number | null;
  local: {
    isMuted: boolean;
    isVideoOn: boolean;
    isPresenting: boolean;
    handRaised: boolean;
    deviceIdMic: string | null;
    deviceIdCam: string | null;
    deviceIdOut: string | null;
    facingMode: "user" | "environment";
  };
  peers: Record<string, CallPeerState>;
  activeSpeakerUserId: string | null;
  presenterUserId: string | null;
  presentQueue: string[];
  quality: ConnectionQuality;
  incoming: IncomingInvite | null;
  permissionError: "mic" | "camera" | "screen" | null;
  reactions: Array<{ id: string; userId: string; emoji: string; expiresAt: number }>;
  recording: boolean; // v2

  // actions
  startCall: (input: { conversationId: string; type: CallType }) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => Promise<void>;
  joinCall: (callId: string) => Promise<void>;
  leaveCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
  cycleCamera: () => Promise<void>;
  selectDevice: (kind: "mic" | "cam" | "out", deviceId: string) => Promise<void>;
  startPresent: () => Promise<void>;
  stopPresent: () => Promise<void>;
  requestPresent: () => void;
  toggleHand: () => void;
  sendReaction: (emoji: string) => void;
  setLayout: (layout: CallLayoutMode) => void;
  applySignal: (event: string, data: unknown) => void;
  reset: () => void;
}
```

### 8.4 FSM transitions

```
                     startCall (getUserMedia ok)
idle ──requesting-media──► ringing-out ──callee accept──► connecting ──ICE/SFU ready──► active
                │                                           ▲
                │ media denied                              │
                ▼                                           │
              idle (permissionError)                        │
                                                            │
inbox.call.invite ──► ringing-in ──accept──► requesting-media ──► connecting ──► active
                      │ decline/timeout
                      ▼
                     idle (+ call log via React Query)

active ──ice disconnected──► reconnecting ──ok──► active
         │                     │
         │ end/fail            │ fail 20s
         ▼                     ▼
       ending ──cleanup──► idle

active ──path-changed (P2P→SFU)──► connecting ──► active   // keep overlay; swap session
```

Illegal: `ringing-in` while `status === "active"` (already in a call). Behavior: show a **waiting invite** chip, do not interrupt the current call (busy). v1 can auto-decline with `endReason` busy; MVP: ignore second invite with an in-app toast.

### 8.5 Local media lifecycle

| Event | Action |
| --- | --- |
| Enter `requesting-media` | `getUserMedia`; store stream on session; set `permissionError` on `NotAllowedError` / `NotFoundError` |
| Unmute camera | enable track or re-acquire if never granted |
| Device change (`devicechange`) | if selected id missing, fall back to default and `replaceTrack` |
| Unplug headphones | browser routes OS default; `setSinkId` if output was that device — reset to `default` |
| End / `reset()` | `stop()` all local tracks including screen; `pc.close()`; close mediasoup transports; `replaceMediaSession(null)` |
| Overlay unmount while `active` | **do not** reset — PiP is still in `AppShell` |
| Provider unmount (logout) | `reset()` |

`CallMediaProvider` mounts in `AppShell` (authenticated layout) so PiP and incoming modal survive conversation unmount.

### 8.6 `useRealtimeScope` coupling

When `callId` is set, token includes `call:*` caps. `CallMediaProvider` calls `setRealtimeScope({ ..., callId })`. Clearing call clears `callId` after a tick so the last `call.ended` can arrive.

### 8.7 Speaking flags

- SFU: `applySignal("sfu.active-speaker")` sets `activeSpeakerUserId` and `peers[id].speaking`.
- P2P: session starts an Analyser loop; do not put frequencies in Zustand — only boolean `speaking` at ~10 Hz max (throttle sets).

---

## 9. Component inventory

All under `src/features/calls/`. Reuse `src/ui/*` (Button, IconButton, Avatar, Dialog, LiveRegion). Call overlay is **not** the chat `Dialog` (full viewport, z-index above shell).

### 9.1 Tree

```
src/features/calls/
  CallMediaProvider.tsx      # mounts store subscriptions, incoming handler, PiP host
  CallOverlay.tsx            # full-screen stage
  CallPiP.tsx                # floating window
  IncomingCallModal.tsx      # ring accept/decline
  ChannelCallBanner.tsx      # "Join" in ChatView
  ParticipantGrid.tsx
  ParticipantTile.tsx
  SelfPreviewTile.tsx
  CallControls.tsx           # bar: mute, cam, present, devices, leave
  DeviceMenu.tsx
  ParticipantListPanel.tsx   # v1
  RaiseHandButton.tsx        # v1
  ScreenShareButton.tsx      # v1 wrapper around getDisplayMedia
  PresenterBanner.tsx
  ConnectionQualityChip.tsx
  CallTimer.tsx              # font-mono tabular
  PermissionDeniedCard.tsx
  CallReconnectBanner.tsx
  ReactionBurst.tsx
  RecordingBanner.tsx        # v2 stub, hidden
  CallLogBubble.tsx          # used from MessageBubble switch
  media-session.ts
  webrtc-p2p.ts
  webrtc-sfu.ts
  ice-batch.ts
  stats.ts
  permissions.ts
```

### 9.2 Shell integration

- `AppShell`: render `CallMediaProvider`, `IncomingCallModal`, `CallOverlay` **or** `CallPiP` based on `layout`.
- `ChatView`: `ChannelCallBanner` when `qk.activeCall(conversationId)` is live and local status is idle.
- DM header: audio / video icon buttons → `startCall`.
- `MessageBubble`: if `message.kind === "call_log"` → `CallLogBubble`.
- `NotificationsPanel`: new kinds `incoming_call` / `missed_call` deep links.
- `public/sw.js`: handle push `kind: incoming_call` with actions Accept (opens Pulse URL with `?call=`) / Dismiss.

### 9.3 Overlay vs PiP

| | Overlay | PiP |
| --- | --- | --- |
| When | `layout === "overlay"` and status in connecting/active/reconnecting | User clicks minimize, or navigates to another Pulse route while in call |
| Size | `position: fixed; inset: 0; z-index: 60` | 280×158 (16:9) bottom-right, `z-60`, drag optional v1 |
| Click | — | Expand to overlay |
| Navigate | Minimize control sets PiP so chat is usable | Default when `pathname` is not the call’s conversation |

**Browser Document Picture-in-Picture** (`documentPictureInPicture`): progressive enhancement v1 if available; else CSS floating panel. Do not block on it.

Minimize is **not** `getDisplayMedia`. It is Pulse UI.

### 9.4 IncomingCallModal

- Uses existing `Dialog` patterns but **cannot** close on backdrop (must Accept or Decline). Escape = Decline.
- Avatar, name, “Incoming video call” / “Incoming voice call”, pulsing cyan ring.
- Auto-close on `inbox.call.cancelled` / timeout.

### 9.5 Motion

Framer Motion (already a dependency):

- Tile `layout` + `initial={{ opacity: 0, scale: 0.96 }}` (match MessageBubble’s 150ms ethos; slightly slower: 180ms).
- Speaking ring: CSS `box-shadow` pulse driven by `speaking` boolean, not per-fft React renders.
- Control bar: `onPointerMove` shows; hide after 2.5s idle. Always visible on keyboard focus inside the bar (`:focus-within`).
- Reactions: `y: 24 → -48`, fade.

### 9.6 Accessibility

| Feature | Spec |
| --- | --- |
| Mute | `M` |
| Camera | `V` |
| Leave | `Shift+E` (not `Esc` — Esc declines incoming / closes menus) |
| Present | `Shift+S` (v1) |
| Raise hand | `H` (v1) |
| Live region | `LiveRegion` polite: “{name} joined”, “{name} left”, “{name} muted”, “Connected”, “Reconnecting” |
| Tiles | `role="group"` `aria-label="{name}{, presenting}{, muted}"` |
| Incoming | `role="alertdialog"`, focus Accept |
| Captions | v2 |

Do not steal `M` when the composer is focused — CallOverlay/PiP key handler only when overlay focused or a `data-call-hotkeys` flag is set on the shell during an active call **and** the event target is not `input/textarea/[contenteditable]`.

---

## 10. Permissions & device handling

### 10.1 Mic / camera flow

1. User clicks Call. Status `requesting-media`.
2. `getUserMedia({ audio: constraints, video: type === "video" ? videoConstraints : false })`.
3. **Granted:** proceed to create/accept.
4. **Denied (`NotAllowedError`):** `permissionError: "mic" | "camera"`. Show `PermissionDeniedCard`:
   - Chrome: Settings → Privacy → Site settings → Microphone (copy per engine using `navigator.userAgent` buckets: Chromium / Firefox / Safari).
   - Button “Try again” re-invokes `getUserMedia`.
   - Link to `chrome://settings/content/microphone` cannot be opened from the page — instruct, don’t `window.open` chrome URLs.
5. **NotFoundError:** “No microphone found”.
6. **NotReadableError:** device in use — amber warning, retry.

Query `navigator.permissions.query({ name: "microphone" })` where supported to show state before the prompt (Safari is limited).

**Camera optional on video call:** if camera denied but mic granted, continue as audio-only and toast “Camera blocked — audio only”.

### 10.2 Screen share

- Must be called from a **user gesture**.
- `NotAllowedError` → `permissionError: "screen"` with “You cancelled the picker or this browser blocks screen share.”
- Firefox/Safari tab audio: may be missing; UI does not promise system audio.

### 10.3 Device selection

After permission, `enumerateDevices()` returns labels. `DeviceMenu`:

- Microphone → `getUserMedia({ audio: { deviceId: { exact } } })` → `replaceTrack` on audio sender/producer.
- Camera → same for video.
- Speaker → `HTMLMediaElement.setSinkId` (Chromium). Hide output picker if unsupported.

Persist last device ids in `localStorage` key `pulse:call-devices` (not cookies).

### 10.4 Reconnection UX

`CallReconnectBanner` (amber): “Reconnecting…” with spinner. Maps:

| Underlying | UI |
| --- | --- |
| Realtime `reconnecting` | Same banner, media may still flow |
| ICE `disconnected`/`failed` | Banner + ICE restart |
| SFU transport `connectionstatechange` failed | Recreate transport (v1); if fail, end |

Quality chip stays independent (poor network ≠ reconnecting).

### 10.5 Quality mapping

From inbound RTP + candidate-pair RTT, every 2s:

| Label | Heuristic |
| --- | --- |
| `good` | loss < 2%, RTT < 150ms, jitter < 30ms |
| `ok` | loss < 8%, RTT < 400ms |
| `poor` | otherwise |

Chip: cyan / muted / amber. Tooltip shows “Packet loss 5% · 80ms”.

### 10.6 Notifications (incoming, unfocused)

1. Tab focused: `IncomingCallModal` only (no push).
2. Tab open, unfocused: modal + optional `Notification` API if already granted (in-page).
3. Tab closed: **Web Push** via existing `deliverNotification` + `sw.js`. Click → `/dm/:id?call=:callId` or channel URL. `CallMediaProvider` reads `searchParams.call` and if still `ringing`, opens accept flow.

Add `NotificationKind` values; `shouldDeliverNotification` for calls: honor conversation mute (`mutedUntil`) — muted channel = no push, banner still if the channel is open.

---

## 11. Design system tokens

Pulse UI is editorial monochrome (Hanken Grotesk / Space Grotesk / JetBrains Mono) with light/dark via `prefers-color-scheme`. **Calls add a cinematic, always-dark layer** and two semantic accents. Do not switch the chat app to Inter.

### 11.1 New CSS variables (`app/globals.css`)

```css
:root {
  --call-canvas: #121212;
  --call-elevated: #1e1e1e;
  --call-elevated-2: #262626;
  --call-ink: #f5f5f5;
  --call-muted: rgb(245 245 245 / 0.55);
  --call-accent: #52d3fe;           /* active, unmute, join, speaking */
  --call-accent-fg: #041016;
  --call-warning: #d4a017;         /* desaturated amber */
  --call-warning-fg: #1a1404;
  --call-danger: #e85d4c;          /* end call — keep distinct from chat ink invert */
  --call-tile-ring: var(--call-accent);
  --call-present-ring: #f5f5f5;
}

@theme inline {
  --color-call-canvas: var(--call-canvas);
  --color-call-elevated: var(--call-elevated);
  --color-call-accent: var(--call-accent);
  --color-call-warning: var(--call-warning);
  --color-call-danger: var(--call-danger);
}
```

Chat `--canvas` / `--ink` stay as they are. Call overlay sets `background: var(--call-canvas); color: var(--call-ink); font-family: var(--font-sans)`.

### 11.2 Tile states

| State | Treatment |
| --- | --- |
| Idle | `--call-elevated`, 1px dashed hairline at 20% white (Pulse dashed language) |
| Speaking | 2px solid `--call-accent`, soft pulse `opacity 0.6↔1` 1.2s on the ring only |
| Muted | Mic-off icon bottom-left, no ring even if analyser spikes |
| Camera off | Avatar + display name, no black empty video |
| Presenting | `--call-present-ring` solid, mono label `PRESENTING`, no mirror |
| Connecting | `Skeleton` pulse on tile |
| Poor connection | Amber corner chip on that tile (from consumer score) |
| Hand raised | Small hand badge top-right |

### 11.3 Control bar

- Height 56px, `--call-elevated`, top hairline.
- Primary actions (mute, camera, present, leave): 40px circles.
- Mute **off** (you are heard): ghost. Mute **on**: `--call-warning` fill.
- Leave: `--call-danger` fill, not cyan.
- Join / unmute camera: `--call-accent`.
- Hide on idle pointer; `:focus-within` always shown.
- Timer: `font-family: var(--font-mono); font-variant-numeric: tabular-nums;` (`CallTimer`).

### 11.4 Incoming modal

- Surface `--call-elevated` even if the OS theme is light (portal to `document.body`).
- Accept = cyan. Decline = ghost hairline.

### 11.5 Banner (channel)

- Chat-chrome compatible: dashed `border-hairline`, cyan “Join” ghost that inverts on hover like existing buttons — do not paint the whole chat header `#121212`.

---

## 12. Key interaction specs

### 12.1 Incoming call (DM)

1. Caller starts video. Callee, Pulse focused: modal, ringtone optional (Web Audio oscillator, **user-gesture gated** — first Pulse click elsewhere may have unlocked audio; if not, visual only). Prefer a short bundled `public/sounds/ring.mp3` played on `invite` if `AudioContext` state is running.
2. Accept → media prompt if not yet granted → overlay connecting → remote video.
3. Decline → modal closes; caller overlay “Call declined”; both get `call_log` `declined` / caller sees ended.
4. 30s timeout → missed log in both DM histories (`logKind: "missed"`).
5. Caller hangs up during ring → callee modal closes; log `cancelled`.

**Busy:** callee already `active` on another call → Pulse auto-declines with toast on caller “{name} is in another call” (MVP: still ring? **Locked: do not ring; treat as decline busy** so we never nest CallStores).

### 12.2 Adding a participant to a 1:1 call (P2P → SFU)

Pulse 1:1 DMs cannot gain a third member without a `group_dm`. Flow:

1. In-call control “Add person” (v1) opens a user picker (reuse `StartConversationDialog` search).
2. `POST /api/calls/:id/add-participant { userId }`:
   - Server creates (or finds) a `group_dm` with `{ caller, callee, userId }`.
   - Updates `Call.conversationId` to the group_dm id (or **creates a new Call** on the group_dm and ends the DM call with `endReason: "replaced"` linking `replacedByCallId` — **prefer replace**: cleaner logs). **Locked: replace.** End DM call with log “Call continued in group”; create new SFU call on group_dm with both current peers auto-joined + invite third.
3. Both current clients receive `call.path-changed` / replaced call id:
   - Keep local `MediaStream` (do not re-prompt getUserMedia).
   - Close `RTCPeerConnection`.
   - `upgrade-sfu` / join new call: Device.load, transports, produce existing tracks.
   - Brief `connecting` on the overlay (“Moving to group call…”).
4. Third user: group_dm ring (modal + push).
5. Media path is SFU from this point.

If the picker is used from a **channel** call, skip group_dm; the user must already be a channel member (private: add to channel first with existing member APIs).

### 12.3 Presenter handoff

1. A is presenting. B clicks Share → `call.present-request` → A’s overlay: “B wants to present” Accept / Dismiss. Moderator can Accept too.
2. Accept → REST `presenter = B`. A’s display track stops (browser `ended` or we `stop()`). B’s `getDisplayMedia` runs **after** grant (B must click Share again if the first gesture was consumed — **Locked: B’s original click starts a request; after grant, show “Start sharing now” on B requiring a second gesture.** Honest with browser gesture rules.
3. Queue is FIFO. New presenter clears the queue entry.
4. If A stops sharing without handoff, `presenterUserId = null`; next request auto-promotes or anyone may start.

### 12.4 PiP while navigating

1. Active overlay on `/dm/xyz`. User opens `/inbox` or another channel.
2. `CallMediaProvider` sets `layout: "pip"` unless the new route is the same `conversationId`.
3. Audio continues. Remote video in PiP (active speaker or presenter).
4. Click PiP → `layout: "overlay"` and **do not force-navigate** (user may want overlay on top of inbox). A “Go to conversation” link on the PiP chrome is enough.

### 12.5 Mute and presence

Every local mute/camera change: (1) track.enabled / replaceTrack, (2) CallStore, (3) `call.mute-state`, (4) `presence.update`. Peers trust mute-state events; presence is backup for late join.

---

## 13. Phased build roadmap

### MVP — 1:1 audio/video only

**Ship:**

- Domain: `Call`, `CallParticipant`, `Message.kind: "call_log"`, REST create/accept/decline/end/connected, ice credentials
- Realtime: `pulseChannel.call`, token `callId`, events in §2.5.1 P2P subset + inbox invite/cancel/miss + conv started/ended
- Client: CallStore FSM, `webrtc-p2p.ts`, IncomingCallModal, CallOverlay (2 tiles), CallControls (mute, camera, devices, end), CallTimer, quality chip, PermissionDeniedCard, CallReconnectBanner, CallLogBubble, push + sw.js
- coturn in dev compose
- Hotkeys M/V, live regions
- Presence on `call:{id}`

**Explicitly out:** mediasoup, group join, screen share, PiP (nice-to-have if cheap; not blocking), reactions, raise hand

**Exit criteria:** two browsers on separate networks (TURN used), missed call appears in DM history, deny-mic shows recovery UI, ICE restart survives a 5s network drop.

### v1 — Group calls + screen share

- `noirly-sfu` service, Pulse BFF, `mediasoup-client`
- Channel banner, grid, participant list, raise hand, moderator mute
- Screen share + presenter queue + `upgrade-sfu` for 1:1 present and 3rd-person add
- PiP, reactions, active speaker observer, simulcast
- `ws:{id}` optional huddle pip on the rail
- Raise realtime publish limit; ICE already batched

**Exit criteria:** 8 participants in a channel, one presenter, a 3G-throttled viewer stays on low layer without freezing others; add-third migrates a live DM call.

### v2 — Backgrounds, noise, recording, captions

- MediaPipe ImageSegmenter worker + blur/virtual background toggle
- RNNoise AudioWorklet, constraint fallback
- SFU recording pipeline + consent banner (`call.recording-state`)
- Live captions via per-peer Web Speech broadcast
- Multi-node SFU (pipe transports) if a single box saturates

### Suggested implementation order inside MVP

1. Protocol types + Mongo + REST without media (create call, log message, inbox event)
2. Incoming modal + push (still no RTP)
3. getUserMedia + P2P signaling on `call:{id}` + overlay
4. Stats, devices, reconnect
5. Polish (motion, a11y, denial UI)

### New packages / repos

| Artifact | Where |
| --- | --- |
| Pulse UI + `mediasoup-client` | `noirly-pulse` (pnpm) |
| SFU | new `noirly-sfu` (pnpm, Node 20+, `mediasoup`) |
| TURN | `coturn` container; secrets in Pulse env |
| Realtime | config bump only (rate limit); no protocol change |

Env (Pulse):

```
NEXT_PUBLIC_REALTIME_WS_URL=
SFU_INTERNAL_URL=http://127.0.0.1:4002
SFU_INTERNAL_SECRET=
TURN_SECRET=
TURN_URLS=turn:turn.example:3478?transport=udp
```

---

## Appendix A — File map (implementation)

| Path | Change |
| --- | --- |
| `src/core/realtime/channels.ts` | `call:` helper |
| `src/core/models/enums.ts` / `types.ts` / `schemas.ts` | Call + Message.kind |
| `src/core/calls/protocol.ts` | WS schemas |
| `src/core/permissions/can.ts` | optional `call.moderate` |
| `src/core/sync/types.ts` / `query-keys.ts` | provider + `qk.call` |
| `src/server/models/Call.ts` / `CallParticipant.ts` | Mongoose |
| `src/server/providers/mongo-sync-provider.ts` | CRUD + publish |
| `app/api/calls/**` | routes |
| `app/api/realtime/token/route.ts` | caps |
| `src/stores/call-store.ts` | FSM |
| `src/features/calls/**` | UI |
| `src/features/realtime/PulseRealtimeProvider.tsx` | scope.callId |
| `src/components/AppShell.tsx` | provider + overlay/PiP |
| `src/features/chat/MessageBubble.tsx` | call_log branch |
| `src/features/chat/ChatView.tsx` | banner + start buttons |
| `public/sw.js` | incoming_call |
| `app/globals.css` | call tokens |
| `docs/ARCHITECTURE.md` | already linked |

## Appendix B — Security notes

- SDP and ICE are **not secret** but they are **PII-adjacent** (IP in candidates). Ephemeral publish + conversation ACL on join is the control. Do not log full SDP in production.
- TURN credentials expire (~15 min); refresh on ICE restart.
- SFU HTTP is bind-internal. Compromise of `SFU_INTERNAL_SECRET` is equivalent to media injection — rotate like `REALTIME_INTERNAL_SECRET`.
- Clients must filter `toUserId`. A malicious participant on `call:{id}` can spam offers; ignore if `fromUserId` is not a live participant (maintain a Pulse-signed participant list in join response and drop others).
- Do not grant `publish` on `conv:*` for calling.

## Appendix C — Testing

- Unit: ICE batcher, FSM transitions, quality mapping, glare polite-peer.
- Integration: Mongo one-live-call partial index; token caps include `call:`.
- E2E Playwright: limited (fake devices `launchPersistentContext` with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`). Two contexts, accept call, assert call_log message. SFU tests in `noirly-sfu` with mediasoup `plainTransport` loopback.

---

*End of calling architecture. Messaging contracts remain in `docs/ARCHITECTURE.md`.*
