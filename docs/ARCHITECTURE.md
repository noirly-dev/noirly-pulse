# Noirly Pulse — Web Architecture

**Product:** Noirly Pulse (web)  
**Audience:** Principal frontend / full-stack implementation  
**Status:** Architecture decision record for MVP → v2  
**Stack:** Next.js App Router · React 19 · TypeScript strict · Tailwind v4 · pnpm · Zustand · TanStack Query v5 · Auth.js v5 · MongoDB / Mongoose · `@noirly-dev/realtime-client` · Framer Motion · RHF + Zod (structured forms only)

---

## Locked decisions

| Decision | Choice | Justification |
| --- | --- | --- |
| **Auth** | **Auth.js (NextAuth v5) + Noirly Identity OIDC** | Same SSO as Flow/Ledger. Email/password and Google live **on Identity**, not in Pulse. Clerk would fork the account graph. A Pulse-local credential store would be a second password. |
| **Primary data store** | **MongoDB + Mongoose**, DB `noirly-pulse` | Same host as Identity/Flow/Ledger; **separate database**. Pulse stores Identity `sub` as `user.identitySub` only. |
| **App API** | **Next.js Route Handlers** (`app/api/**`) | Single deployable for MVP; domain in `src/core`. |
| **Realtime** | **noirly-realtime** via `@noirly-dev/realtime-client` | Self-hosted WS. No Supabase Realtime, Pusher, Ably, or Firebase. npm scope is `@noirly-dev/*` (GitHub Packages). |
| **Conversation model** | **Unified `Conversation`** with `kind: dm \| group_dm \| channel` | Messages, reactions, receipts, typing, attachments, and search all key off one id. `Channel` / `DirectMessage` are TypeScript narrowings, not extra collections. |
| **Search (MVP)** | **Mongo `$text`** on message content, ACL-filtered | Workspace/DM-scoped, not web-scale search. Atlas Search / dedicated index in v1/v2. |
| **Repo shape** | **Standalone `noirly-pulse`** (monorepo-ready) | Mirror Flow/Ledger; extract `src/core` → `@noirly/pulse-core` later. Pulse workspaces are **Pulse-owned**, not shared with Flow. |
| **Client server-state** | **TanStack Query v5** | Message history, infinite pagination, workspace/channel CRUD cache. |
| **Client UI state** | **Zustand** | Switcher, open thread, composer draft, palette, connection banner — never a second copy of messages. |
| **Forms** | **React Hook Form + Zod** | Workspace create, channel settings, invites. **Composer is not a form.** |
| **Package manager** | **pnpm** | Required. Dev server port **3004**. |
| **IDs** | Mongo `ObjectId` as string in the API | Matches Flow/Ledger implementation. Client optimistic ids use ULID `clientNonce`. |
| **Calling** | **WebRTC + noirly-realtime signaling + self-hosted mediasoup SFU** | See [`docs/CALLS.md`](./CALLS.md). No Twilio / Daily / Agora / LiveKit Cloud. 1:1 DMs are P2P; group/channel calls go through mediasoup. |

---

## 1. Executive summary & goals

### 1.1 Purpose

Noirly Pulse is a **dark-mode, production-grade messaging web app** for:

- **Individuals** — 1:1 DMs, small group DMs, presence, read receipts, attachments, reactions
- **Teams / businesses** — workspaces, public/private channels, Slack-style threads, RBAC, @mentions, workspace search

One product surface. Mode is determined by **nav context** (Personal vs a team workspace), not by separate apps or separate message types.

Pulse is the most realtime-dependent Noirly product. Live delivery, typing, presence, and receipts are first-class; REST is the system of record for anything that must survive a refresh.

### 1.2 Goals

| Goal | Measure |
| --- | --- |
| Single Noirly account | Auth via Identity (OIDC); no second password store |
| Instant send UX | Optimistic bubble in <16ms of Enter; reconcile on REST 201 + WS `message.sent` |
| Durable history | Mongo is source of truth; WS is fanout + ephemeral collab |
| Missed-event safety | Stream replay by `lastEventId` + REST catch-up after gap/reconnect |
| Team-safe access | Workspace RBAC + private-channel membership; JWT caps never exceed ACL |
| Monorepo-ready | Domain in `src/core` / future `@noirly/pulse-core` |
| Accessible | WCAG AA, keyboard composer/switcher/emoji, ARIA live regions for inbound messages |
| Responsive | Full use at desktop, tablet, and mobile browser widths |

### 1.3 Non-goals (MVP)

- Native mobile / Expo (future app consumes `pulse-core` + the same API)
- Voice/video, screen share, huddles — **moved to [`docs/CALLS.md`](./CALLS.md)** (phased: MVP 1:1 P2P → v1 SFU group + screen share → v2 backgrounds / noise / recording)
- Message encryption / E2EE
- Shared workspaces with Flow or Ledger
- Light theme
- Full offline-first / CRDT chat
- Dedicated search cluster (Meilisearch, Typesense, Elasticsearch)
- Custom emoji packs, bots, incoming webhooks (v2)
- Per-message “seen by everyone” in large channels (DM receipts only in MVP)

### 1.4 Product principles

1. **Mongo is system truth. React Query is cache truth. noirly-realtime patches the cache.**
2. **Clients never persist durable chat.** The browser POSTs; the server writes; the server publishes. Clients may publish **ephemeral** typing and **WebRTC signaling** only, on dedicated channels (`ty:{id}`, `call:{callId}`).
3. **One Conversation id** for DMs, group DMs, and channels. Threads are messages with `threadParentId`, not a second conversation.
4. **Personal is a nav mode, not a fake team.** DMs live at user scope. Team workspaces own channels.
5. **Realtime channel names are `kind:id`.** The engine rejects extra colons. Nested paths like `workspace:{id}:channel:{id}` are invalid.

### 1.5 REST vs realtime (one-screen split)

| Flows through REST (persist + ACL) | Flows exclusively through noirly-realtime |
| --- | --- |
| Message history pagination, edit, delete | Live `message.sent` / `edited` / `deleted` fanout after persist |
| Workspace / channel / member CRUD | Typing (`typing.start` / `typing.stop`) — ephemeral, client-published |
| User profiles, last-seen snapshot | Presence join/leave (protocol, not app events) |
| Reactions toggle | Live `reaction.added` / `reaction.removed` fanout after persist |
| Read-receipt persist (`lastReadMessageId`) | Live `read.receipt` fanout after persist |
| Search, uploads, notification list | Inbox badges / mention pings (`inbox.*`) |
| Auth session, realtime JWT mint | Connection status, replay, reconnect |
| Call create / join / ICE credentials / SFU join | WebRTC offer/answer/ICE + call presence (`call:{callId}`, ephemeral) |

Reconciliation: WS appends/patches React Query; on reconnect, subscribe with `lastEventId`; on `recovery:gap` or stale tab, REST `?after=` catch-up. Details in §5.

---

## 2. Project structure

### 2.1 Near-term repo layout (`noirly-pulse`)

Treat the current repo as the **web app**. A future Turborepo can lift `src/core` → `packages/pulse-core` and this app → `apps/web` with minimal churn.

```text
noirly-pulse/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   └── login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx                      # AppShell + providers (Query, Realtime, palette)
│   │   ├── page.tsx                        # redirect → last scope (personal or workspace)
│   │   ├── inbox/page.tsx                  # cross-scope unreads
│   │   ├── search/page.tsx                 # personal-scope search (DMs + groups)
│   │   ├── settings/
│   │   │   ├── page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   └── preferences/page.tsx
│   │   ├── (personal)/
│   │   │   ├── layout.tsx                  # DM list sidebar
│   │   │   ├── page.tsx                    # empty / last DM
│   │   │   └── dm/[dmId]/
│   │   │       ├── page.tsx                # conversation + optional thread panel
│   │   │       └── thread/[messageId]/page.tsx  # mobile full-screen thread
│   │   └── (workspace)/
│   │       └── w/[workspaceId]/
│   │           ├── layout.tsx              # membership guard + channel sidebar + role
│   │           ├── page.tsx                # workspace home / browse channels
│   │           ├── inbox/page.tsx
│   │           ├── search/page.tsx
│   │           ├── members/page.tsx
│   │           ├── settings/page.tsx
│   │           ├── channels/page.tsx       # public channel directory
│   │           └── channel/[channelId]/
│   │               ├── page.tsx
│   │               └── thread/[messageId]/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── health/route.ts
│   │   ├── me/route.ts
│   │   ├── workspaces/
│   │   │   ├── route.ts
│   │   │   └── [workspaceId]/
│   │   │       ├── route.ts
│   │   │       ├── members/route.ts
│   │   │       ├── invites/route.ts
│   │   │       └── channels/route.ts
│   │   ├── conversations/
│   │   │   ├── route.ts                    # list DMs / create DM or group
│   │   │   └── [conversationId]/
│   │   │       ├── route.ts
│   │   │       ├── members/route.ts
│   │   │       ├── read/route.ts
│   │   │       ├── messages/route.ts       # GET page, POST send
│   │   │       └── typing/route.ts         # unused — typing is WS-only
│   │   ├── messages/
│   │   │   └── [messageId]/
│   │   │       ├── route.ts                # PATCH edit, DELETE soft-delete
│   │   │       └── reactions/route.ts
│   │   ├── search/route.ts
│   │   ├── uploads/route.ts
│   │   ├── notifications/route.ts
│   │   ├── push/route.ts                   # v1 Web Push subscribe
│   │   └── realtime/token/route.ts
│   ├── layout.tsx
│   ├── globals.css
│   └── not-found.tsx
├── src/
│   ├── core/                               # backend-agnostic (future @noirly/pulse-core)
│   │   ├── models/
│   │   │   ├── enums.ts
│   │   │   ├── types.ts
│   │   │   └── schemas.ts                  # Zod
│   │   ├── permissions/
│   │   │   ├── can.ts
│   │   │   └── visibility.ts               # private channel rules
│   │   ├── markdown/
│   │   │   ├── parse.ts                    # bold/italic/code/links/mentions
│   │   │   └── sanitize.ts
│   │   ├── mentions/
│   │   │   └── extract.ts
│   │   └── sync/
│   │       ├── types.ts                    # PulseSyncProvider
│   │       └── query-keys.ts
│   ├── server/
│   │   ├── db/mongodb.ts
│   │   ├── models/                         # Mongoose schemas
│   │   ├── auth/                           # session + first-login bootstrap
│   │   ├── providers/mongo-sync-provider.ts
│   │   ├── realtime/jwt.ts
│   │   ├── realtime/publish.ts             # POST /internal/publish
│   │   └── api/http.ts
│   ├── features/
│   │   ├── auth/
│   │   ├── shell/
│   │   ├── workspace/
│   │   ├── channels/
│   │   ├── chat/
│   │   ├── threads/
│   │   ├── composer/
│   │   ├── presence/
│   │   ├── inbox/
│   │   ├── search/
│   │   ├── command-palette/
│   │   ├── notifications/
│   │   └── realtime/
│   ├── components/                         # composed, non-primitive
│   ├── ui/                                 # design-system primitives
│   ├── stores/                             # Zustand
│   ├── hooks/
│   └── lib/
│       ├── api-client.ts
│       ├── query-client.ts
│       └── cn.ts
├── docs/
│   └── ARCHITECTURE.md
├── public/
├── tests/
├── proxy.ts                                # Next 16 auth gate (not middleware.ts)
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.json
```

URL notes (route groups do not appear in the path):

| Route group | Public URL |
| --- | --- |
| `(auth)/login` | `/login` |
| `(app)/(personal)/dm/[dmId]` | `/dm/[dmId]` |
| `(app)/(workspace)/w/[workspaceId]/channel/[channelId]` | `/w/[workspaceId]/channel/[channelId]` |

`/w/` avoids colliding with `/inbox`, `/settings`, `/dm`, `/search`. Same convention as Flow/Ledger.

Group DMs share `/dm/[dmId]` — `dmId` is a **conversation id**, not a user id.

### 2.2 Future Turborepo target

```text
noirly/
├── apps/pulse-web/          # this Next app
├── apps/pulse-mobile/       # later
├── packages/pulse-core/     # today's src/core
└── packages/ui/             # optional shared primitives
```

Do not extract packages until two consumers exist.

### 2.3 Layering rules

1. `src/ui` imports nothing from `features` or `server`.
2. `src/core` is isomorphic: no `next`, no Mongoose, no DOM.
3. Route handlers call `PulseSyncProvider`, then `publishRealtime`. They do not embed query logic.
4. Feature components talk to React Query hooks / Zustand; they do not fetch in event handlers except uploads/composer send (via hooks).
5. No React Native / Expo APIs in this repo.

---

## 3. Data models

IDs are **strings** (Mongo ObjectId hex). Timestamps are **ISO 8601 UTC**. Soft-delete via `deletedAt` on messages (placeholder body). Workspaces and channels use `archivedAt` where recovery matters.

### 3.1 TypeScript interfaces (domain)

```ts
// src/core/models/types.ts

export type WorkspaceKind = "personal" | "team";
export type MemberRole = "owner" | "admin" | "member";
export type ConversationKind = "dm" | "group_dm" | "channel";
export type ChannelVisibility = "public" | "private";
export type MessageStatus = "sending" | "sent" | "failed";
export type AttachmentKind = "image" | "file";
export type NotificationKind = "mention" | "dm" | "thread_reply";
export type NotificationPref = "all" | "mentions" | "none";

export interface User {
  id: string;
  identitySub: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl: string | null;
  /** Persisted heartbeat; live "online" is presence, not this field. */
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  kind: WorkspaceKind;
  name: string;
  slug: string;
  ownerUserId: string;
  iconUrl: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: MemberRole;
  createdAt: string;
  updatedAt: string;
}

/**
 * Unifying chat surface. DMs, group DMs, and channels are the same document.
 * `Channel` and `DirectMessage` below are narrowed views — not extra tables.
 */
export interface Conversation {
  id: string;
  kind: ConversationKind;
  workspaceId: string | null;
  name: string | null;
  slug: string | null;
  topic: string | null;
  visibility: ChannelVisibility | null;
  /** Sorted "idA:idB" for 1:1 DMs; unique index. Null otherwise. */
  dmKey: string | null;
  archivedAt: string | null;
  createdById: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Channel = Conversation & {
  kind: "channel";
  workspaceId: string;
  name: string;
  slug: string;
  visibility: ChannelVisibility;
  dmKey: null;
};

export type DirectMessage = Conversation & {
  kind: "dm";
  workspaceId: null;
  visibility: null;
  dmKey: string;
};

export type GroupDirectMessage = Conversation & {
  kind: "group_dm";
  workspaceId: null;
  visibility: null;
  dmKey: null;
};

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  mutedUntil: string | null;
  notifications: NotificationPref;
}

/** Alias — private/public channel access grant is ConversationMember. */
export type ChannelMember = ConversationMember;

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  filename: string;
  mime: string;
  sizeBytes: number;
  url: string;
  width: number | null;
  height: number | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  mentionedUserIds: string[];
  attachments: Attachment[];
  threadParentId: string | null;
  replyCount: number;
  lastReplyAt: string | null;
  clientNonce: string;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Client-only overlay on Message while send is in flight. Never persisted. */
export interface OptimisticMessage extends Message {
  localStatus: MessageStatus;
}

export interface Reaction {
  id: string;
  messageId: string;
  conversationId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

/**
 * Persisted as fields on ConversationMember (one row per user per conv).
 * Kept as a type so receipts stay explicit in the realtime payload.
 */
export interface ReadReceipt {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  timestamp: string;
}

/**
 * Ephemeral. Never written to Mongo. Never replayed from streams.
 */
export interface TypingState {
  conversationId: string;
  userId: string;
  threadParentId: string | null;
  startedAt: number;
  expiresAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  workspaceId: string | null;
  conversationId: string;
  messageId: string;
  actorId: string;
  readAt: string | null;
  createdAt: string;
}

export interface Invite {
  id: string;
  workspaceId: string;
  email: string;
  role: Exclude<MemberRole, "owner">;
  tokenHash: string;
  invitedById: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}
```

### 3.2 Why unified Conversation

| Separate Channel + DM tables | Unified Conversation |
| --- | --- |
| Duplicate message/reaction/receipt FKs | One `conversationId` everywhere |
| Two pagination implementations | One infinite query |
| Two realtime maps | `conv:{id}` for every live thread |
| Search unions two collections | Single `$text` + kind filter |

Channel-specific fields (`slug`, `visibility`, `workspaceId`) are **nullable on the document** and required by the `Channel` narrowing. DMs cannot have `workspaceId`.

Threads do **not** get their own conversation. A thread is `Message.threadParentId === parent.id` inside the same conversation (Slack-style).

### 3.3 Mongoose sketch (`noirly-pulse`)

Same Mongo **host** as Identity; database name **`noirly-pulse`**. Never write into `noirly-identity`.

```text
users
  { identitySub, email, emailVerified, displayName, avatarUrl?, lastSeenAt?, createdAt, updatedAt }
  unique(identitySub)

workspaces
  { kind, name, slug, ownerUserId, iconUrl?, archivedAt?, createdAt, updatedAt }
  unique(slug) for team workspaces

workspace_members
  { workspaceId, userId, role, createdAt, updatedAt }
  unique(workspaceId, userId)

conversations
  { kind, workspaceId?, name?, slug?, topic?, visibility?, dmKey?, archivedAt?,
    createdById, lastMessageAt?, lastMessagePreview?, createdAt, updatedAt }
  unique(dmKey) sparse
  unique(workspaceId, slug) sparse
  index(workspaceId, lastMessageAt)
  index(kind, lastMessageAt)

conversation_members
  { conversationId, userId, joinedAt, lastReadMessageId?, lastReadAt?, mutedUntil?, notifications }
  unique(conversationId, userId)
  index(userId, lastReadAt)

messages
  { conversationId, senderId, content, mentionedUserIds[], attachments[],
    threadParentId?, replyCount, lastReplyAt?, clientNonce, editedAt?, deletedAt?,
    createdAt, updatedAt }
  unique(senderId, clientNonce)
  index(conversationId, threadParentId, createdAt)
  text index on content

reactions
  { messageId, conversationId, userId, emoji, createdAt }
  unique(messageId, userId, emoji)

notifications
  { userId, kind, workspaceId?, conversationId, messageId, actorId, readAt?, createdAt }
  index(userId, createdAt)

invites
  { workspaceId, email, role, tokenHash, invitedById, expiresAt, acceptedAt?, createdAt }

uploads (metadata only; bytes in object storage)
  { userId, filename, mime, sizeBytes, url, createdAt }
```

Embed `attachments[]` on the message after upload completes. Do not store file bytes in Mongo.

### 3.4 Personal vs team

- **Personal nav** (`/dm/...`): conversations with `kind` in `{dm, group_dm}`. No workspace RBAC. Membership is `ConversationMember` only.
- **Team workspace** (`/w/{id}/...`): conversations with `kind: channel` and `workspaceId`. Access = workspace membership ∩ channel visibility rules (§9).
- On first Pulse login: upsert `User` by `identitySub`. Create a **personal workspace** (`kind: personal`) for icon-rail consistency and future “saved messages”; it does **not** contain DMs. DMs stay user-scoped.
- Team workspaces are created explicitly; invites create `WorkspaceMember` rows.

### 3.5 1:1 DM identity

`dmKey = [userIdA, userIdB].sort().join(":")`. `POST /api/conversations` with `{ kind: "dm", userId }` is idempotent: return the existing conversation.

---

## 4. API / data layer design

### 4.1 Backend choice (MVP)

**Primary:** MongoDB + Mongoose + Next.js Route Handlers, database `noirly-pulse`.

**Why not Supabase/Neon Postgres for MVP**

- Identity, Flow, and Ledger already run on the same Mongo host. Pulse joining that topology is one ops story (backups, local `mongodb://127.0.0.1:27017`, no second cloud vendor).
- Chat documents (messages with attachments, mentions, reply counts) map cleanly to documents; we are not doing multi-row SQL transactions beyond “insert message + bump parent replyCount + bump conversation preview,” which Mongo can do in a short session.
- Realtime is **already** noirly-realtime. Using Supabase “for the database” would invite accidental use of Supabase Realtime — explicitly disallowed.

**Why not a standalone Pulse Node service yet**

- Flow/Ledger proved route handlers + `src/core` + `src/server` is enough for MVP.
- Extract a `pulse-api` worker when upload/search/push fanout needs independent scaling (v2).

**Object storage:** S3-compatible (Cloudflare R2 or MinIO locally). Dev fallback: disk under `.uploads/` via the uploads route. Env: `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.

### 4.2 PulseSyncProvider (backend-agnostic)

```ts
// src/core/sync/types.ts

export interface PageCursor {
  before?: string; // message id — older than
  after?: string;  // message id — newer than (reconnect catch-up)
  limit?: number;  // default 50, max 100
}

export interface MessagePage {
  messages: Message[];
  nextCursor: string | null; // older
  prevCursor: string | null; // newer
}

export interface PulseSyncProvider {
  // users
  getMe(): Promise<User>;
  heartbeat(): Promise<void>;

  // workspaces
  listWorkspaces(): Promise<Array<Workspace & { role: MemberRole; unreadCount: number }>>;
  createWorkspace(input: { name: string }): Promise<Workspace>;
  getWorkspace(id: string): Promise<Workspace & { role: MemberRole }>;
  updateWorkspace(id: string, input: { name?: string; slug?: string }): Promise<Workspace>;
  listMembers(workspaceId: string): Promise<Array<WorkspaceMember & { user: User }>>;
  updateMemberRole(workspaceId: string, userId: string, role: MemberRole): Promise<void>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
  createInvite(workspaceId: string, input: { email: string; role: Exclude<MemberRole, "owner"> }): Promise<Invite>;

  // conversations
  listConversations(scope: {
    kind?: ConversationKind[];
    workspaceId?: string;
  }): Promise<Array<Conversation & { unreadCount: number; members: User[] }>>;
  getConversation(id: string): Promise<Conversation>;
  createDm(userId: string): Promise<Conversation>;
  createGroupDm(input: { userIds: string[]; name?: string }): Promise<Conversation>;
  createChannel(input: {
    workspaceId: string;
    name: string;
    visibility: ChannelVisibility;
    topic?: string;
  }): Promise<Channel>;
  updateChannel(id: string, input: { name?: string; topic?: string; visibility?: ChannelVisibility }): Promise<Channel>;
  archiveChannel(id: string): Promise<void>;
  addChannelMembers(conversationId: string, userIds: string[]): Promise<void>;
  removeChannelMember(conversationId: string, userId: string): Promise<void>;

  // messages
  listMessages(conversationId: string, query: PageCursor & { threadParentId?: string | null }): Promise<MessagePage>;
  sendMessage(input: {
    conversationId: string;
    content: string;
    clientNonce: string;
    attachmentIds?: string[];
    threadParentId?: string | null;
  }): Promise<Message>;
  editMessage(messageId: string, content: string): Promise<Message>;
  deleteMessage(messageId: string): Promise<Message>;

  // reactions / receipts
  toggleReaction(messageId: string, emoji: string): Promise<{ added: boolean; reaction: Reaction | null }>;
  markRead(conversationId: string, lastReadMessageId: string): Promise<ReadReceipt>;

  // search / notifications / uploads
  searchMessages(input: {
    q: string;
    workspaceId?: string;
    conversationId?: string;
    cursor?: string;
  }): Promise<{ hits: Array<Message & { conversation: Conversation }>; nextCursor: string | null }>;
  listNotifications(cursor?: string): Promise<{ items: Notification[]; nextCursor: string | null }>;
  markNotificationsRead(ids: string[]): Promise<void>;
  createUpload(file: { filename: string; mime: string; sizeBytes: number; body: Buffer }): Promise<Attachment>;
}
```

The browser talks HTTP via `src/lib/api-client.ts`. Server route handlers call `getSyncProvider()` (Mongo adapter). Tests can inject a fake provider.

### 4.3 REST shape

JSON envelopes match Flow: `{ data }` or `{ error: { code, message } }`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/me` | Current Pulse user + last-seen |
| `POST` | `/api/me/heartbeat` | Update `lastSeenAt` |
| `GET/POST` | `/api/workspaces` | List / create team workspace |
| `GET/PATCH` | `/api/workspaces/:id` | Get / rename |
| `GET/POST` | `/api/workspaces/:id/members` | Members / add |
| `PATCH/DELETE` | `/api/workspaces/:id/members/:userId` | Role / kick |
| `POST` | `/api/workspaces/:id/invites` | Email invite |
| `GET/POST` | `/api/workspaces/:id/channels` | List / create channel |
| `GET/POST` | `/api/conversations` | List DMs+groups / create DM or group |
| `GET/PATCH` | `/api/conversations/:id` | Get / update topic/name |
| `GET/POST` | `/api/conversations/:id/members` | Channel members |
| `GET` | `/api/conversations/:id/messages?before=&after=&limit=&threadParentId=` | Cursor page |
| `POST` | `/api/conversations/:id/messages` | Send (idempotent on `clientNonce`) |
| `PATCH/DELETE` | `/api/messages/:id` | Edit / soft-delete |
| `POST` | `/api/messages/:id/reactions` | Toggle `{ emoji }` |
| `PUT` | `/api/conversations/:id/read` | `{ lastReadMessageId }` |
| `GET` | `/api/search?q=&workspaceId=&cursor=` | Message search |
| `POST` | `/api/uploads` | Multipart; returns attachment metadata |
| `GET` | `/api/notifications` | In-app inbox |
| `GET` | `/api/realtime/token?workspaceId=&conversationId=` | Capability-scoped WS JWT |

Send body:

```ts
{
  content: string;           // markdown subset, max 8000 chars
  clientNonce: string;       // ULID, required
  attachmentIds?: string[];
  threadParentId?: string | null;
}
```

### 4.4 Auth strategy

See §9. Pulse is an OIDC **client** of Noirly Identity (`client_id: noirly-pulse`). Session: Auth.js JWT cookie for `proxy.ts`. Google and email/password are Identity features; Pulse only has “Continue with Noirly.”

### 4.5 Why not GraphQL for MVP

Chat pagination, file upload, and idempotent send are simpler as REST. A GraphQL layer can wait until a third client (mobile) needs a single round-trip schema. Query keys already give the client a typed cache.

---

## 5. Real-time architecture

### 5.1 Engine constraints (non-negotiable)

Package: `@noirly-dev/realtime-client` + `@noirly-dev/realtime-shared`.

Channel names **must** match:

```text
^[a-z][a-z0-9_-]*:[a-zA-Z0-9_-]{1,128}$
```

That is **one colon**. `workspace:{workspaceId}:channel:{channelId}` is **invalid**. Pulse flattens to `kind:id`.

JWT caps are per channel: `subscribe` | `publish` | `presence`. Granting `publish` on the conversation channel would let a client spoof `message.sent`. Therefore:

- **Durable events** — server publishes after Mongo write (`subscribe` only for clients).
- **Typing** — separate channel with client `publish`, always `ephemeral: true`.
- **Presence** — protocol `presence-join` / `presence-leave` (`presence` cap, not `publish`).

Issuer for Pulse tokens: `noirly-pulse`. Audience: `noirly-realtime`. TTL: **45s** (same as Flow). Shared `REALTIME_JWT_SECRET` with the realtime process.

Host publish: Pulse route handlers `POST {REALTIME_INTERNAL_URL}/internal/publish` (do not load `ws` inside Next).

### 5.2 Channel map

| Channel | Caps (client JWT) | Presence | Streamed (durable) | Purpose |
| --- | --- | --- | --- | --- |
| `conv:{conversationId}` | `subscribe`, `presence` | Yes | Yes | Messages, edits, deletes, reactions, receipts, thread reply-count |
| `ty:{conversationId}` | `subscribe`, `publish` | No | **No** (ephemeral) | Typing only |
| `ws:{workspaceId}` | `subscribe`, `presence` | Yes | Yes | Channel created/archived, membership, workspace unread hints |
| `inbox:{userId}` | `subscribe` | No | Yes | Mentions, new DMs, badge bumps for conversations not currently open |

Helpers (must go through `assertChannelName`):

```ts
export const pulseChannel = {
  conv: (id: string) => `conv:${id}` as ChannelName,
  typing: (id: string) => `ty:${id}` as ChannelName,
  workspace: (id: string) => `ws:${id}` as ChannelName,
  inbox: (userId: string) => `inbox:${userId}` as ChannelName,
};
```

**Do not** subscribe the client to another user’s `inbox:*`. Token minting only includes `inbox:{session.userId}`.

### 5.3 Event types

**On `conv:{id}` (server → clients, durable):**

| Event | Payload (sketch) |
| --- | --- |
| `message.sent` | `{ message: Message }` |
| `message.edited` | `{ messageId, content, editedAt, mentionedUserIds }` |
| `message.deleted` | `{ messageId, deletedAt }` |
| `reaction.added` | `{ reaction: Reaction }` |
| `reaction.removed` | `{ messageId, userId, emoji }` |
| `read.receipt` | `{ receipt: ReadReceipt }` |
| `thread.updated` | `{ parentId, replyCount, lastReplyAt }` |
| `conversation.updated` | `{ conversationId, lastMessageAt, lastMessagePreview }` |

**On `ty:{id}` (clients → all subscribers, ephemeral):**

| Event | Payload |
| --- | --- |
| `typing.start` | `{ userId, displayName, threadParentId: string \| null }` |
| `typing.stop` | `{ userId, threadParentId: string \| null }` |

Ignore any other event name on `ty:*`.

**On `ws:{id}` (server → members):**

| Event | Payload |
| --- | --- |
| `channel.created` | `{ channel: Channel }` |
| `channel.archived` | `{ channelId }` |
| `channel.updated` | `{ channel: Channel }` |
| `member.joined` | `{ userId, role }` |
| `member.left` | `{ userId }` |

**On `inbox:{userId}` (server → that user):**

| Event | Payload |
| --- | --- |
| `inbox.message` | `{ conversationId, messageId, senderId, preview, workspaceId }` |
| `inbox.mention` | `{ conversationId, messageId, senderId, workspaceId }` |
| `inbox.thread_reply` | `{ conversationId, parentId, messageId, senderId }` |
| `inbox.dm.created` | `{ conversation: Conversation }` |
| `inbox.unread` | `{ conversationId, unreadCount }` |

Presence is **not** an app event. Use `usePresence(convChannel)` / `usePresence(wsChannel)`. Member `data` may include `{ displayName, avatarUrl, threadParentId?: string | null }` so we can show “viewing thread” later.

### 5.4 Who publishes what

```text
Send message
  UI optimistic insert
    → POST /api/conversations/:id/messages
    → Mongo insert (idempotent clientNonce)
    → publish conv:{id}  message.sent
    → publish inbox:{otherUser} inbox.message   (if they are not the sender)
    → if mentions: notifications + inbox.mention
    → if threadParentId: conv thread.updated + inbox.thread_reply for parent followers

Typing
  UI debounce
    → client.publish(ty:{id}, "typing.start", { ... }, { ephemeral: true })
    → never hits Mongo, never hits Redis streams
```

### 5.5 Hook usage

```tsx
// features/realtime/PulseRealtimeProvider.tsx
// Mirrors Flow: module-level scope → /api/realtime/token query string.

import { RealtimeClient } from "@noirly-dev/realtime-client";
import {
  RealtimeProvider,
  useChannel,
  usePresence,
  useRealtimeEvent,
  useRealtimeStatus,
} from "@noirly-dev/realtime-client/react";

// In the open conversation view:
useChannel(pulseChannel.conv(conversationId), { presence: true, lastEventId, replayLimit: 100 });
useChannel(pulseChannel.typing(conversationId), { replayLimit: 0 });

useRealtimeEvent<MessageSent>(conv, "message.sent", (data, meta) => {
  if (meta.replay) { /* still apply; dedupe by message.id / clientNonce */ }
  patchMessageCache(queryClient, data.message);
});

useRealtimeEvent(ty, "typing.start", (data) => typingStore.getState().onStart(data));
useRealtimeEvent(ty, "typing.stop", (data) => typingStore.getState().onStop(data));

const { members, join, leave } = usePresence(conv, { collapseByUserId: true });
useEffect(() => {
  void join({ displayName: me.displayName, avatarUrl: me.avatarUrl });
  return () => { void leave(); };
}, [conversationId]);
```

Always subscribe to `inbox:{me}` and `ws:{activeWorkspaceId}` from the app shell (not per message list).

Token minting (`GET /api/realtime/token`):

1. Always cap `inbox:{userId}` = `["subscribe"]`.
2. If `workspaceId`: verify membership; cap `ws:{id}` = `["subscribe","presence"]`; cap `conv`+`ty` for every **channel the user can access** in that workspace (public + private memberships). Public channels: all members. Private: `ConversationMember` only.
3. If personal scope: cap `conv`+`ty` for the **100 most recently active** DMs/groups the user belongs to, plus `conversationId` if provided (so opening an old DM still works).
4. If the open conversation is missing from the token, the provider sets scope and **reconnects** so `getToken` remints.

JWT size: keep channel lists bounded (100 convs). Inbox events cover the rest for badges.

### 5.6 REST vs realtime data flow

```text
┌────────────┐  POST message   ┌─────────────┐  write   ┌──────────────┐
│  Composer  │ ───────────────►│ Route Handler│ ───────►│ Mongo Pulse  │
└────────────┘                 └──────┬──────┘          └──────────────┘
       │ optimistic                   │ publish
       ▼                              ▼
 React Query cache ◄────────── WS event (conv / inbox)
       │
       └── on ack: replace nonce with canonical Message
```

| Data | Read path | Write path | Live path |
| --- | --- | --- | --- |
| History | `GET .../messages?before=` infinite query | — | `message.sent` append if not in cache |
| Send | — | `POST .../messages` | echo `message.sent` (dedupe nonce) |
| Edit/delete | — | `PATCH/DELETE /api/messages/:id` | patch cache |
| Typing | Zustand | WS publish ephemeral | WS |
| Presence | `usePresence` | protocol join | protocol |
| Last-seen | `User.lastSeenAt` via REST | heartbeat 60s | presence = online now |
| Unread | `ConversationMember` + list payload | `PUT .../read` | `inbox.unread` + `read.receipt` |
| Search | `GET /api/search` | — | none (stale-while-revalidate) |
| Profiles | REST / embedded on members | Identity + Pulse user upsert | — |

### 5.7 Reconciliation on reconnect

Order of defense:

1. **Subscribe with `lastEventId`** from `EventIdTracker` / `useChannel`. Server replays durable stream events (`replay: true`). Apply the same cache patchers; skip if `message.id` or `clientNonce` already present.
2. **`recovery:gap`** (client event from `@noirly-dev/realtime-client`): do not trust the stream. REST catch-up:
   `GET /api/conversations/:id/messages?after={newestCachedId}&limit=100`
   Merge by id. If the page is full, loop or invalidate the infinite query.
3. **Visibility resume:** if `document.visibilityState` becomes `visible` and last WS event is older than 30s, run the same `?after=` catch-up for the **open** conversation, and `GET /api/conversations` (or workspace channel list) to refresh unread badges.
4. **Do not** refetch the entire infinite history (that would jump scroll). Only merge newer messages; older pages stay.
5. **Typing state is dropped on reconnect** (ephemeral, not replayed). Correct.
6. **Presence** is rebuilt from join snapshots after resubscribe; call `join` again.
7. Failed optimistic rows (`localStatus: "failed"`) are **not** removed by replay. User retries or discards.

If realtime is down entirely: composer still POSTs REST; other tabs/users see messages on next catch-up or refresh. Show the amber connection banner from `useRealtimeStatus()`.

### 5.8 Client publish policy (security)

Realtime server authorizes **channel caps**, not Pulse event names. Therefore:

- Clients **must not** have `publish` on `conv:*`, `ws:*`, or `inbox:*`.
- Clients have `publish` only on `ty:{conversationId}` they can access.
- UI ignores `ty:*` payloads whose `userId` does not match a known member (defense in depth).

---

## 6. State management architecture

### 6.1 Zustand (client UI only)

Never store message lists, member directories, or search hits in Zustand.

```ts
// src/stores/ui-store.ts
interface UiState {
  commandPaletteOpen: boolean;
  emojiPicker: { messageId: string } | null;
  threadParentId: string | null;          // desktop side panel
  connectionBannerDismissed: boolean;
  setPaletteOpen: (open: boolean) => void;
  openThread: (messageId: string) => void;
  closeThread: () => void;
}

// src/stores/workspace-store.ts
interface WorkspaceUiState {
  activeWorkspaceId: "personal" | string; // "personal" is nav mode, not always a Mongo id
  sidebarCollapsed: boolean;
  setActiveWorkspaceId: (id: "personal" | string) => void;
}

// src/stores/composer-store.ts
interface ComposerState {
  drafts: Record<string, string>;         // key: conversationId or convId:threadId
  setDraft: (key: string, value: string) => void;
}

// src/stores/typing-store.ts
interface TypingStateStore {
  byConv: Record<string, Record<string, TypingState>>; // convId → userId → state
  onStart: (s: Omit<TypingState, "expiresAt"> & { threadParentId: string | null }) => void;
  onStop: (conversationId: string, userId: string, threadParentId: string | null) => void;
  pruneExpired: () => void;
}

// src/stores/unread-store.ts
interface UnreadState {
  byConversationId: Record<string, number>;
  byWorkspaceId: Record<string, number>;
  bump: (conversationId: string, workspaceId: string | null) => void;
  set: (conversationId: string, count: number) => void;
  clear: (conversationId: string) => void;
}
```

Unread **seeds** from REST list payloads, then **bumps** from `inbox.*`. Opening a conversation and succeeding `PUT .../read` calls `clear`.

Typing store prunes on a 1s interval; `expiresAt = now + 3500` on each `typing.start`.

### 6.2 React Query keys

```ts
// src/core/sync/query-keys.ts
export const qk = {
  me: ["me"] as const,
  workspaces: ["workspaces"] as const,
  workspace: (id: string) => ["workspace", id] as const,
  members: (workspaceId: string) => ["workspace", workspaceId, "members"] as const,
  conversations: (scope: string) => ["conversations", scope] as const,
  conversation: (id: string) => ["conversation", id] as const,
  messages: (conversationId: string, threadParentId: string | "root") =>
    ["messages", conversationId, threadParentId] as const,
  search: (workspaceId: string | "personal", q: string) => ["search", workspaceId, q] as const,
  notifications: ["notifications"] as const,
};
```

`scope` is `"personal"` or `workspace:{id}`.

### 6.3 Infinite query (message history)

Chat is **newest-at-bottom**, load **older on scroll-up**.

```ts
useInfiniteQuery({
  queryKey: qk.messages(conversationId, threadParentId ?? "root"),
  queryFn: ({ pageParam }) =>
    api.listMessages(conversationId, {
      before: pageParam,
      limit: 50,
      threadParentId: threadParentId ?? null,
    }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage) => lastPage.nextCursor, // older
  refetchOnWindowFocus: false, // catch-up is explicit (§5.7)
  staleTime: Infinity,         // WS + catch-up keep it fresh
});
```

Page shape: each page is chronological ascending. The UI concatenates `pages` in reverse-page order (oldest page first) then flattens, or stores pages oldest→newest and virtualizes.

Virtualization: `@tanstack/react-virtual` on the message column (Ledger already uses it). Stick-to-bottom unless the user is scrolled up (`isPinnedToBottom` local ref). New messages while scrolled up increment a “N new messages” chip; clicking jumps to bottom.

**Cache patch helpers** (used by both REST mutations and WS handlers):

- `appendMessage(queryClient, message)` — by `clientNonce` then `id`; ignore dupes
- `replaceNonce(queryClient, nonce, message)` — optimistic → canonical
- `patchMessage(queryClient, id, partial)`
- `tombstoneMessage(queryClient, id, deletedAt)` — keep row, clear content
- `upsertReaction(...)`

Mutations use `useMutation` with `onMutate` for send/edit/react; WS is the fanout to other clients and a second ack for the sender.

### 6.4 What does not go in React Query

- Typing indicators
- Presence member lists (the realtime client `PresenceStore` is source)
- Composer caret / draft text (Zustand, survive channel switch)
- Whether the thread panel is open (Zustand + URL)

---

## 7. Routing structure

### 7.1 Route groups

| Group | Path prefix | Layout |
| --- | --- | --- |
| `(auth)` | `/login` | Centered, no chrome |
| `(app)` | everything else | AppShell: workspace rail, cmd-k, realtime, toasts |
| `(app)/(personal)` | `/dm/...` | DM/group list |
| `(app)/(workspace)` | `/w/[workspaceId]/...` | Channel list + role context |

### 7.2 Route table

| Route | Auth | Description |
| --- | --- | --- |
| `/login` | public | Continue with Noirly |
| `/api/auth/*` | Auth.js | OIDC |
| `/` | required | Redirect to last conversation or `/inbox` |
| `/inbox` | required | Cross-scope unread list |
| `/search` | required | Personal DM/group search |
| `/settings/*` | required | Profile, notification prefs |
| `/dm/[dmId]` | member of conv | 1:1 or group DM |
| `/dm/[dmId]/thread/[messageId]` | member | Mobile thread |
| `/w/[workspaceId]` | workspace member | Home / channel browser |
| `/w/[workspaceId]/channel/[channelId]` | channel ACL | Channel chat |
| `/w/[workspaceId]/channel/[channelId]/thread/[messageId]` | channel ACL | Mobile thread |
| `/w/[workspaceId]/search` | member | Workspace message search |
| `/w/[workspaceId]/members` | member (manage: admin+) | Members |
| `/w/[workspaceId]/settings` | admin+ | Workspace settings |
| `/w/[workspaceId]/channels` | member | Public directory / join |

Desktop threads prefer `?thread={messageId}` on the channel/DM URL (panel) so back-stack stays clean. The `/thread/` segment is for **narrow viewports** and shareable deep links; the layout can still render a panel on desktop if the segment is present.

### 7.3 proxy.ts (Next 16)

Do **not** use `middleware.ts`. Next 16 uses `proxy.ts` (see Flow).

```ts
// proxy.ts (conceptual — same pattern as noirly-flow)
export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");
  const isAuthApi = pathname.startsWith("/api/auth");
  if (!request.auth && !isLogin && !isAuthApi) {
    const login = new URL("/login", request.nextUrl.origin);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  if (request.auth && isLogin) {
    return NextResponse.redirect(new URL("/", request.nextUrl.origin));
  }
  return NextResponse.next();
});
```

RBAC is **not** in proxy. Layouts + API enforce membership.

### 7.4 Layout guards

- `(personal)/dm/[dmId]/page.tsx` (or a small server wrapper): load conversation; 404 if not a member; 404 if `kind` is `channel`.
- `(workspace)/w/[workspaceId]/layout.tsx`: load workspace + role; 404 on 403/404; wrap `WorkspaceRoleProvider`.
- `channel/[channelId]/page.tsx`: load conversation; if `visibility === "private"` and not a `ConversationMember`, 404 (do not leak existence beyond “not found”).
- Public channels: workspace members may open even before an explicit join; opening **upserts** `ConversationMember` so unread tracking works.

### 7.5 Last-scope redirect

Persist `{ scope: "personal" | "workspace", workspaceId?, conversationId? }` in `localStorage` (`pulse:last-scope`) and optionally on `User` later. `/` reads it and `redirect()`.

---

## 8. Component inventory

Atomic rule: `ui` → `components` → `features`. Features may import ui/components; ui never imports features.

### 8.1 `src/ui` — primitives

| Component | Role |
| --- | --- |
| `Button` | primary cyan, ghost, danger amber |
| `IconButton` | rail, composer toolbar |
| `Input`, `Textarea`, `Select`, `Checkbox`, `Switch` | forms |
| `Avatar`, `AvatarGroup` | people + presence ring |
| `Badge` | unread counts |
| `Dialog`, `Drawer`, `Popover`, `DropdownMenu` | overlays, focus trap |
| `Tooltip` | shortcuts |
| `Skeleton` | lists |
| `ScrollArea` | sidebars |
| `Separator` | `#2A2A2A` |
| `Kbd` | cmd-k glyphs |
| `Toast` | send failure, copied link |
| `Spinner` | sending state |
| `LiveRegion` | visually hidden `aria-live="polite"` |

No feature imports. Tokens only.

### 8.2 `src/components` — composed

| Component | Role |
| --- | --- |
| `AppShell` | left workspace rail + main |
| `WorkspaceRail` | personal icon + team icons, unread dots |
| `Sidebar` | DM list or channel list |
| `TopBar` | title, presence avatars, search, user menu |
| `EmptyState` | no messages / no channels |
| `ConfirmDialog` | delete message, archive channel |
| `Timestamp` | JetBrains Mono, relative + tooltip absolute |
| `UnreadBadge` | 99+ |
| `ConnectionBanner` | amber, reconnecting / offline |
| `UserMentionChip` | in composer and bubbles |

### 8.3 `src/features` — domain

**shell / workspace**

- `WorkspaceSwitcher` (rail + mobile drawer)
- `CreateWorkspaceDialog` (RHF + Zod)
- `MembersTable`, `RoleBadge`, `InviteDialog`

**channels**

- `ChannelNav`, `ChannelNavItem` (unread, mute)
- `ChannelHeader` (topic, members, thread toggle)
- `CreateChannelDialog`, `ChannelSettingsForm`
- `PrivateChannelInvite`

**chat**

- `MessageList` (virtualized, infinite older)
- `MessageGroup` (consecutive same-sender collapse)
- `MessageBubble` (variants: own / other / sending / failed / deleted)
- `MessageActions` (react, reply in thread, edit, delete)
- `ReactionBar`, `EmojiPicker` (keyboard grid)
- `ReadReceipt` (DM: Delivered / Seen)
- `UnreadSeparator`
- `NewMessagesChip`
- `AttachmentPreview`, `ImageLightbox`
- `TypingIndicator` (Framer Motion dots)

**composer**

- `MessageComposer` (contenteditable, **not** RHF)
- `ComposerToolbar` (bold, italic, code, attach, emoji)
- `MentionAutocomplete`
- `FileDropOverlay`

**threads**

- `ThreadPanel` (desktop)
- `ThreadReplyCount`
- `ThreadView` (reuses `MessageList` + `MessageComposer` with `threadParentId`)

**presence**

- `PresenceAvatars`
- `PresenceDot` (online / idle / offline)
- `LastSeenLabel`

**inbox / search / notifications / palette**

- `InboxList`
- `SearchResults`, `SearchHit`
- `NotificationBell`
- `CommandPalette` (`cmdk`)

**realtime**

- `PulseRealtimeProvider`
- `ConversationRealtime` (hooks for the open conv)
- `InboxRealtime` (shell-level)

**auth**

- `LoginScreen`, `ContinueWithNoirlyButton`

### 8.4 Motion (Framer Motion — sparse)

| Moment | Motion |
| --- | --- |
| Message arrival | opacity 0→1 + 8px translateY, 150ms, only if pinned to bottom |
| Typing dots | three-dot scale pulse, `aria-hidden` on the animation, accessible text “N people typing” |
| Presence avatars | layout animation on join/leave, 200ms |
| Thread panel | x-translate + opacity |
| Connection banner | height/opacity |

No ambient loops on the message list. Respect `prefers-reduced-motion`: skip translate; keep opacity.

### 8.5 Accessibility inventory (must-haves)

- Composer: `role="textbox"` `aria-multiline` `aria-label="Message"`; toolbar buttons with labels; `Cmd/Ctrl+Enter` send, `Enter` send (Shift+Enter newline) — documented in settings, default Slack-like Enter-to-send on desktop.
- Emoji picker: roving tabindex, arrow keys, Escape closes, focus returns to invoker.
- Channel switcher / palette: focus trap, typeahead, Escape.
- Message list: `aria-live="polite"` via `LiveRegion` announcing “New message from {name}” when the tab is focused and the user is **not** at the bottom (avoid double-reading the bubble).
- Thread panel: `aria-modal="false"` (not a dialog on desktop); mobile thread route is a page. Focus moves to thread composer on open; restore to parent composer on close.
- Unread badges: `aria-label="{n} unread"`.
- Contrast: see §10.

---

## 9. Authentication & authorization

### 9.1 AuthN — Noirly Identity via Auth.js

```text
User → Pulse /login → Auth.js → Identity /authorize (PKCE)
     → /api/auth/callback/noirly
     → Auth.js JWT session cookie
     → upsert Pulse User by identitySub
     → ensure personal Workspace (kind: personal)
```

| Item | Value |
| --- | --- |
| Scopes | `openid profile email offline_access` |
| Client | confidential server client `noirly-pulse` registered in Identity |
| Redirect | `{PULSE_URL}/api/auth/callback/noirly` |
| Session | Auth.js JWT (edge-readable in `proxy.ts`); claims include `identitySub` + Pulse `userId` |

Email/password, verification, and Google: **only on Identity**. Pulse never stores password hashes and never adds a Google provider of its own.

Register the client with Identity (`npm run client:register` in `noirly-identity`) the same way as Flow.

### 9.2 AuthZ — two layers

**A. Workspace RBAC** (team workspaces only)

| Action | owner | admin | member |
| --- | --- | --- | --- |
| View public channels / search workspace | ✓ | ✓ | ✓ |
| Send / edit own / react / thread | ✓ | ✓ | ✓ |
| Create public channel | ✓ | ✓ | |
| Create private channel | ✓ | ✓ | |
| Archive / rename channel | ✓ | ✓ | |
| Invite / change roles / kick (not owners) | ✓ | ✓ | |
| Delete / transfer workspace | ✓ | | |
| See private channel without membership | | | |

Personal workspace: single member, always `owner`. No channels required for MVP.

Pure functions in `src/core/permissions/can.ts`:

```ts
can(role: MemberRole, action: PermissionAction): boolean
assertCan(role, action): void
```

**B. Conversation visibility** (`src/core/permissions/visibility.ts`)

| Kind | Can read/write |
| --- | --- |
| `dm` / `group_dm` | `ConversationMember` only |
| `channel` + `public` | any `WorkspaceMember` of `workspaceId` |
| `channel` + `private` | `WorkspaceMember` **and** `ConversationMember` |

Slack-like: workspace owners **cannot** see private channels they were not added to. API returns 404, not 403, for private misses (avoid existence leak).

Message edit/delete: author, or `admin+` in that workspace for channel messages. DMs: author only (no “admin” of a DM). Soft-delete always.

### 9.3 API enforcement

Every mutating route:

1. Session → Pulse `userId`
2. Load conversation or workspace
3. `assertCanView` / `assertCan`
4. Mutate
5. `publishRealtime`

Never trust client-sent `role`. Realtime JWT caps are computed from the same visibility helpers.

### 9.4 Personal vs workspace access (product)

- Opening Pulse as an individual never requires creating a team.
- Switching to a team workspace hides the DM list and shows channels (Discord-like rail). DMs remain reachable via the Personal icon and Cmd+K.
- Unread on the Personal icon = sum of DM/group unreads. Unread on a team icon = sum of channel unreads in that workspace (respecting mute).

---

## 10. Design system tokens

Dark-only: `color-scheme: dark` on `html`. No theme toggle.

### 10.1 Color

| Token | Value | Usage |
| --- | --- | --- |
| `--np-bg` | `#121212` | App background |
| `--np-surface` | `#1E1E1E` | Sidebars, composer, elevated panels, other-bubbles |
| `--np-surface-hover` | `#242424` | Hover rows |
| `--np-border` | `#2A2A2A` | Borders, unread separator line |
| `--np-accent` | `#52D3FE` | Primary actions, focus rings, unread dots, **own bubbles**, active nav |
| `--np-accent-muted` | `#52D3FE33` | Selection wash, unread row |
| `--np-accent-fg` | `#0A0A0A` | Text/icons on filled cyan (AA) |
| `--np-warning` | `#D9A759` | Failed send, connection lost, destructive emphasis |
| `--np-warning-muted` | `#D9A75933` | Failed bubble wash |
| `--np-text` | `#F5F5F5` | Primary text |
| `--np-text-muted` | `#A3A3A3` | Secondary, timestamps (mono), deleted placeholder |
| `--np-online` | `#3DDC97` | Presence online (muted; cyan stays the brand accent) |
| `--np-offline` | `#6B6B6B` | Presence offline |

Cyan **text** on `#121212` is for large/bold UI only; body links can be cyan if ≥ 16px / 700, otherwise underline + `#52D3FE` on hover with sufficient size. **Filled** cyan buttons and own-bubbles use `--np-accent-fg`.

### 10.2 Typography

| Role | Family | Notes |
| --- | --- | --- |
| UI + message body | **Inter** | 14px body, 15px messages, 600 headings |
| Timestamps only | **JetBrains Mono** | `12px`, `--np-text-muted`, tabular |

`next/font/google`: `Inter`, `JetBrains_Mono`. Do not use Geist (scaffold default).

### 10.3 Spacing, radius, elevation

```text
spacing: 4, 8, 12, 16, 24, 32, 48, 64
radius: sm 6px, md 10px, lg 14px, bubble 12px (own: 12px with 4px tail corner)
shadow: prefer border + surface lift; optional 0 1px 0 #0006
focus: 2px solid var(--np-accent) offset 2px
rail width: 64px
sidebar: 260px (hidden → drawer < md)
thread panel: 400px
composer min-height: 44px, max ~40vh
```

### 10.4 Tailwind v4 (`app/globals.css`)

```css
@theme inline {
  --color-np-bg: #121212;
  --color-np-surface: #1e1e1e;
  --color-np-surface-hover: #242424;
  --color-np-border: #2a2a2a;
  --color-np-accent: #52d3fe;
  --color-np-accent-muted: #52d3fe33;
  --color-np-accent-fg: #0a0a0a;
  --color-np-warning: #d9a759;
  --color-np-text: #f5f5f5;
  --color-np-text-muted: #a3a3a3;
  --color-np-online: #3ddc97;
  --font-sans: var(--font-inter);
  --font-mono: var(--font-jetbrains);
}
```

Prefix `np-` (Noirly Pulse) so tokens do not collide if ui is later shared. Values match Flow’s charcoal/cyan/amber.

### 10.5 Message bubble variants

| Variant | Surface | Text | Extra |
| --- | --- | --- | --- |
| `own-sent` | `#52D3FE` | `#0A0A0A` | right-aligned |
| `own-sending` | `#52D3FE` @ 55% | `#0A0A0A` | spinner, `aria-busy` |
| `own-failed` | transparent, 1px `#D9A759` | `#F5F5F5` | Retry / Discard |
| `other` | `#1E1E1E` | `#F5F5F5` | left, avatar on group/channel |
| `deleted` | transparent | `#A3A3A3` italic | “This message was deleted” |
| `system` | none | `#A3A3A3` | centered, v1 |

Edited: muted “edited” suffix in JetBrains Mono 11px. Code spans: surface + mono for the **code**, not the timestamp font on whole bubbles.

---

## 11. Key interaction specs

### 11.1 Optimistic send / retry

1. Generate `clientNonce` (ULID).
2. Insert `OptimisticMessage` into the **latest** infinite page (`localStatus: "sending"`). Stick to bottom if pinned.
3. `POST /api/conversations/:id/messages` with nonce.
4. **201:** replace optimistic row with server `Message` (`localStatus` dropped). Treat as success even if WS has not arrived.
5. **WS `message.sent`:** if `clientNonce` or `id` exists, no-op (sender). Recipients `appendMessage`.
6. **Network / 5xx:** `localStatus: "failed"`. Retry resends **same nonce** (unique index). Discard removes the row locally only.
7. **409 duplicate nonce:** treat as success; fetch message by nonce or accept returned body.
8. Attachments: upload first (`POST /api/uploads`), then send with `attachmentIds`. Optimistic image uses object URL; revoke on success/fail.

Idempotency lives in Mongo `unique(senderId, clientNonce)`, not in the WS layer.

### 11.2 Typing indicator debounce

| Parameter | Value |
| --- | --- |
| Start | First keystroke if not already typing in that `{conv, threadParentId}` |
| Keepalive | Re-send `typing.start` every **3000ms** while keys continue |
| Stop idle | **2000ms** after last keystroke → `typing.stop` |
| Stop hard | Send, blur composer, unmount, thread close |
| Receiver display | Show until `typing.stop`, inbound `message.sent` from that user, or **3500ms** TTL |
| Channel | `ty:{conversationId}`, `ephemeral: true` |
| Thread | Payload includes `threadParentId`; root composer ignores thread typing and vice versa |

Do not send typing for a single character of IME composition until `compositionend`.

Max names in the indicator: 3 + “and N more”. Motion on dots only.

### 11.3 Thread open / close

**Desktop (≥ md):** `ThreadPanel` over the right of the channel. Zustand `threadParentId` synced to `?thread=` (replace, not push). Esc closes if picker/dialogs are not open. Focus → thread composer. Closing restores focus to the parent bubble’s reply control or the root composer.

**Mobile:** navigate to `.../thread/[messageId]`. Back closes.

Opening a thread:

- Subscribes to the **same** `conv` / `ty` channels (already open).
- Starts `useInfiniteQuery` with `threadParentId`.
- Does not create a new realtime channel.

Parent bubble shows `ThreadReplyCount`; `thread.updated` patches count without opening the panel.

### 11.4 @mention autocomplete

1. Trigger: `@` at token start (after space/newline/start).
2. Query: workspace members (channel) or conversation members (DM/group), client-filter first 20 from the already-cached member query; if `q.length >= 2` and cache miss, `GET .../members?q=`.
3. Keyboard: ArrowUp/Down, Enter/Tab insert, Esc close, `@` + click.
4. Insert a chip: display `@Name`, underlying markdown `[@Name](pulse://user/{id})`.
5. `extractMentions(content)` → `mentionedUserIds` on send (server re-parses; never trust client list alone).
6. Notify: `Notification` + `inbox.mention`. Do not notify the author. Respect `notifications: "none"` / mute.

### 11.5 Read receipts — timing

**When to consider a message read**

- Conversation is the foreground route
- `document.visibilityState === "visible"`
- User is **pinned to bottom** or the message intersects ≥ 60% for **400ms** (Intersection Observer)
- If the user is scrolled up in history, **do not** advance `lastReadMessageId` past the last fully viewed message

**When to persist**

- Debounce **800ms** batched `PUT /api/conversations/:id/read`
- Flush immediately on conversation change, thread close, `visibilitychange` → hidden, `pagehide`

**What to show**

- **DM (1:1):** check marks or “Seen” when the other user’s `lastReadMessageId` ≥ this message; “Delivered” after own `localStatus === "sent"`
- **Group DM:** “Seen by N” on the latest own message only (not every bubble)
- **Channel:** no per-user ticks in MVP; unread separator + badge only

WS `read.receipt` patches member last-read in the conversation query; DM ticks update without refetch.

### 11.6 Command palette (Cmd+K / Ctrl+K)

Library: **cmdk** (same as Flow).

Actions: Jump to DM, Jump to channel, Switch workspace, Search messages (`/` query → `/search` or workspace search), Create channel (if `can`), Invite, Settings.

Unread items sort above. Esc closes; focus returns to composer if it was focused.

### 11.7 Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+K` | Palette |
| `Cmd/Ctrl+Enter` | Send (also Enter by default) |
| `Shift+Enter` | Newline |
| `Esc` | Close picker / thread / dialog (stacked) |
| `Alt+↑ / Alt+↓` | Previous / next channel or DM in the sidebar |
| `Cmd/Ctrl+Shift+A` | Mark conversation read |
| `E` | Edit last own message (when composer empty) |
| `R` | Start thread on focused message |
| `/` | Focus search (when not in composer) |

Ignore letter shortcuts while the composer or an input is focused (except send, palette, Esc).

### 11.8 Emoji reactions

Click/long-press → picker. Toggle via REST; optimistic reaction chip. Keyboard: focus message → `+` opens picker. Common row: 👍 ❤️ 😂 🎉 👀.

### 11.9 Connection lost

`useRealtimeStatus()` ∈ `{reconnecting, closed}` → amber `ConnectionBanner`. Composer remains enabled (REST). After `ready`, run catch-up (§5.7). Failed sends stay failed until retry.

---

## 12. Search design

### 12.1 MVP — Mongo `$text`

- Index: `{ content: "text" }` on `messages`, plus compound `{ conversationId: 1, createdAt: -1 }`.
- Query: ACL first (conversation ids the user may see), then `$text` with `$textScore`, exclude `deletedAt != null`.
- Scope:
  - `/search` — DMs + group DMs the user belongs to
  - `/w/{id}/search` — channels in that workspace the user can view
- Pagination: cursor = `{ score, id }` (stable).
- UI: hit snippet (180 chars around match), conversation name, `Timestamp`, click → ` /dm/{id}?highlight={messageId}` or channel equivalent; message list fetches a window around that id (`after`/`before`) and scrolls to it.

**Why not a dedicated index in MVP**

- Pulse search is private, ACL-heavy, and workspace-sized. Mongo text is enough for tens of thousands of messages per workspace.
- A sidecar (Meilisearch/Typesense) doubles ops and must stay in lockstep with deletes/private channels. Wrong ACL in an index is a data leak.

**Limits:** no fuzzy typo-tolerance, no attachment OCR, English default stemming. Cap query to 200ms server-side; return partial.

### 12.2 v1 — Atlas Search

Same REST shape. Swap the provider method `searchMessages` to Atlas Search for stemming, highlights, and better ranking. Keep ACL pre-filter (`conversationId in ...`).

### 12.3 v2 — dedicated index

Only if Atlas is insufficient (global user search across huge histories, bot logs). Indexer consumes the same durable events (`message.sent/edited/deleted`) so REST and search cannot diverge. Still **not** a third-party realtime bus.

Cmd+K “search messages” is a jump to the search route with `q`, not a second backend.

---

## 13. Phased build roadmap

### Phase 0 — Foundations (week 1)

- pnpm, port 3004, Inter / JetBrains Mono, `np-*` tokens, `ui` primitives
- Auth.js + Identity client `noirly-pulse`
- Mongoose models + first-login user + personal workspace bootstrap
- AppShell + workspace rail + `proxy.ts`
- `PulseSyncProvider` + Mongo adapter stubs
- `PulseRealtimeProvider` token mint (inbox + one dummy cap)
- Vitest for `can` / `visibility` / mention extract / markdown sanitize

**Exit:** login → empty personal inbox, authenticated API health.

### Phase 1 — MVP Personal messaging (weeks 2–4)

- 1:1 DM create (idempotent `dmKey`) + group DM
- Message list infinite scroll + composer (markdown subset, no mentions yet)
- Optimistic send / retry / fail
- Image/file uploads
- Edit / soft-delete
- Emoji reactions
- Typing on `ty:*`
- Presence on `conv:*` + `lastSeenAt` heartbeat
- DM read receipts
- Cmd+K jump to DM
- Realtime `message.*` + reconnect catch-up
- Responsive: rail → drawer, list + chat stack on small screens

**Exit:** two browsers, 1:1 and group, live messages, typing, seen ticks, reconnect does not drop or duplicate.

### Phase 2 — MVP Team (weeks 5–7)

- Team workspace create / invite / RBAC
- Public + private channels
- Slack-style threads (panel + mobile route)
- @mentions + in-app notifications + `inbox:*`
- Channel presence avatars
- Workspace search (`$text`)
- Unread badges on rail / channel nav
- Channel create/archive (admin+)
- Member management

**Exit:** two members in a private channel cannot be seen by a third; public channel is visible to all members; mention notifies; threads isolate replies.

### Phase 3 — v1 (weeks 8–11)

- Browser Web Push (VAPID) for mentions/DMs/thread replies
- Notification preferences (all / mentions / mute)
- Atlas Search swap-in
- Message link highlight + jump-to-message from search
- Virtualized lists at 10k messages
- E2E Playwright: send, reconnect, permissions, thread
- Saved messages (personal workspace channel) optional
- Admin delete of others’ channel messages
- Connection-quality telemetry (optional)

### Phase 4 — v2

- Extract `packages/pulse-core` into Turborepo
- Mobile app against the same API + realtime
- Custom emoji, bots, incoming webhooks
- Optional dedicated search index
- Voice clips / richer embeds
- Shared Noirly workspace graph with Flow (only if product demands it)
- Google shown on Identity, still not a Pulse-local IdP

---

## Appendix A — Environment variables

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3004
AUTH_URL=http://localhost:3004
AUTH_SECRET=replace-with-at-least-32-chars-of-random-data
AUTH_TRUST_HOST=true

# Same Mongo host as Identity; different database name
MONGODB_URI=mongodb://127.0.0.1:27017/noirly-pulse

# Noirly Identity OIDC (register client noirly-pulse)
AUTH_NOIRLY_ISSUER=http://localhost:3000
AUTH_NOIRLY_CLIENT_ID=noirly-pulse
AUTH_NOIRLY_CLIENT_SECRET=

# noirly-realtime (pnpm --filter @noirly-dev/realtime-server dev)
REALTIME_JWT_SECRET=dev-noirly-realtime-jwt-secret-change-me-32
REALTIME_JWT_ISSUER=noirly-pulse
REALTIME_JWT_AUDIENCE=noirly-realtime
REALTIME_INTERNAL_URL=http://127.0.0.1:4001
REALTIME_INTERNAL_SECRET=dev-noirly-realtime-jwt-secret-change-me-32
NEXT_PUBLIC_REALTIME_WS_URL=ws://127.0.0.1:4001/ws

# Uploads (optional in Phase 1; disk fallback if unset)
S3_BUCKET=
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
```

Local port map: Identity `3000` · Flow `3002` · Ledger `3003` · Pulse `3004` · realtime `4001`.

## Appendix B — Testing strategy

| Layer | Tool |
| --- | --- |
| Unit (permissions, visibility, markdown, mentions, query-key helpers) | Vitest |
| Infinite-cache patchers (append/dedupe/nonce) | Vitest |
| Component a11y | Testing Library + axe |
| API | Vitest + mongodb-memory-server |
| E2E | Playwright (two contexts / two users) |

Critical E2E: optimistic send, duplicate nonce, private channel 404, typing does not persist after reload, reconnect catch-up, thread reply count.

## Appendix C — Risk register

| Risk | Mitigation |
| --- | --- |
| Client spoofing `message.sent` on WS | No `publish` cap on `conv:*`; typing isolated on `ty:*` |
| JWT too large (all DMs) | Cap 100 recent convs + always `inbox:{user}`; remint on open |
| Nested channel names | Flatten to `kind:id`; helpers + `assertChannelName` |
| Duplicate bubbles on echo | Dedupe `clientNonce` then `id` |
| Missed events after laptop sleep | `lastEventId` replay + `recovery:gap` REST `?after=` |
| Private channel leaks | 404; caps only for membership; search ACL pre-filter |
| Dual-DB drift vs Identity | Couple only on `identitySub`; no cross-DB joins |
| Search ACL bugs | Filter conversation ids **before** `$text`; tests for private |

## Appendix D — Implementation order (first PRs)

1. pnpm + tokens + fonts + `ui` primitives  
2. Auth.js Noirly provider + session + `proxy.ts`  
3. Mongoose models + user bootstrap  
4. AppShell + rail + personal DM list  
5. Send/list messages + optimistic cache  
6. noirly-realtime `conv` / `ty` / inbox token  
7. Presence, typing, receipts  
8. Attachments + reactions + edit/delete  
9. Team workspace + channels + threads  
10. Mentions, search, Cmd+K, unread badges  

## Appendix E — npm packages (initial)

```text
@noirly-dev/realtime-client
@noirly-dev/realtime-shared
next-auth@5 (Auth.js)
@tanstack/react-query
@tanstack/react-virtual
zustand
zod
react-hook-form
mongoose
jose
cmdk
framer-motion
```

Composer: custom contenteditable in `features/composer`. Revisit TipTap only if a11y of the custom editor fails audits — do not start with a full editor framework.

---

*End of architecture document. Structural decisions are locked: Identity + Auth.js, Mongo `noirly-pulse`, unified Conversation, Mongo `$text` search, flattened noirly-realtime channels. Re-open only if product replaces noirly-realtime or requires a separate Channel collection / dedicated search cluster.*
