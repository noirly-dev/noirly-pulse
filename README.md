# Noirly Pulse

Dark-mode messaging for the Noirly ecosystem. Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Phase status

| Phase | Scope |
| --- | --- |
| **0** | Identity login, shell, health, realtime JWT |
| **1** | Personal DMs, composer, reactions, typing, presence |
| **2** | Team workspaces, channels, threads, mentions, search |
| **3** | Push (VAPID), notification prefs, virtualized lists, search jump-to-message, admin delete, Playwright smoke |

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
pnpm exec playwright install chromium
pnpm test:e2e
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Dev server on port 3004 |
| `pnpm build` | Production build |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright smoke tests |
