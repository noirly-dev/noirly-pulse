# Noirly Pulse

Dark-mode messaging for the Noirly ecosystem. Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Phase status

| Phase | Scope |
| --- | --- |
| **0** | Identity login, shell, health, realtime JWT |
| **1** | Personal DMs, composer, reactions, typing, presence |
| **2** | Team workspaces, channels, threads, mentions, search |
| **3** | Push (VAPID), notification prefs, virtualized lists, search jump-to-message, admin delete, Playwright smoke + two-user E2E |

## Quick start

```bash
pnpm install
cp .env.example .env.local
# Register the OIDC client (Identity must be running / Mongo up):
cd ../noirly-identity
npm run client:register -- --client-id=noirly-pulse --name=NoirlyPulse --redirect-uri=http://localhost:3004/api/auth/callback/noirly --write-env=../noirly-pulse/.env.local
cd ../noirly-pulse
pnpm dev
```

App: http://localhost:3004  
Identity: http://localhost:3000  
Realtime (optional): `ws://127.0.0.1:4001/ws`

### Web Push (optional)

```bash
npx web-push generate-vapid-keys
# Copy public/private into .env.local (see .env.example)
```

Enable push from **Settings → Browser push** after signing in.

### E2E

```bash
pnpm exec playwright install chromium   # or set PLAYWRIGHT_CHROMIUM_EXECUTABLE
pnpm test:e2e
```

`e2e/two-user.spec.ts` drives two real accounts through Identity and
noirly-realtime (DM delivery, receipts, threads, reactions, edits, private
channels, mentions, search scope). It is skipped unless credentials are set:

```bash
# Identity running with the noirly-pulse client registered, realtime on :4001,
# and two verified Identity users (npm run db:seed creates dev@noirly.test).
PULSE_E2E_USER_A=dev@noirly.test PULSE_E2E_USER_B=you@example.com \
PULSE_E2E_PASSWORD='...' pnpm test:e2e
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Dev server on port 3004 |
| `pnpm build` | Production build |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright smoke tests |
