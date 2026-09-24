import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Two-user flows against a real Noirly Identity + noirly-realtime (Appendix B).
 *
 * Needs Identity (AUTH_NOIRLY_ISSUER) with the noirly-pulse client registered,
 * noirly-realtime on NEXT_PUBLIC_REALTIME_WS_URL, and two verified Identity
 * users. In noirly-identity, `npm run db:seed` creates dev@noirly.test.
 *
 *   PULSE_E2E_USER_A=dev@noirly.test PULSE_E2E_USER_B=you@example.com \
 *   PULSE_E2E_PASSWORD=... pnpm test:e2e two-user
 */
const USER_A = process.env.PULSE_E2E_USER_A;
const USER_B = process.env.PULSE_E2E_USER_B;
const PASSWORD = process.env.PULSE_E2E_PASSWORD;

test.skip(!USER_A || !USER_B || !PASSWORD, "Set PULSE_E2E_USER_A/B and PULSE_E2E_PASSWORD");
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

async function signIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: /Noirly Login/i }).click();
  const popup = await popupPromise;
  // Identity's own login page (not Pulse's /login/popup), once hydrated: the
  // submit button stays disabled until then.
  await popup.waitForURL((url) => url.pathname === "/login" && url.origin !== new URL(page.url()).origin);
  const submit = popup.getByRole("button", { name: /^sign in$/i });
  await expect(submit).toBeEnabled();
  await popup.getByLabel(/email/i).first().fill(email);
  await popup.getByLabel(/password/i).first().fill(PASSWORD!);
  await submit.click();
  // Poll the URL rather than wait for a navigation event: the popup finishes
  // with window.location.assign, which can complete before a waiter attaches.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
  return page;
}

async function api<T>(page: Page, path: string, init?: { method: string; body?: unknown }) {
  return page.evaluate(
    async ([p, i]) => {
      const res = await fetch(p, {
        method: i?.method ?? "GET",
        headers: { "Content-Type": "application/json" },
        body: i?.body === undefined ? undefined : JSON.stringify(i.body),
      });
      return { status: res.status, body: (await res.json().catch(() => null)) as unknown };
    },
    [path, init] as const,
  ) as Promise<{ status: number; body: T }>;
}

test("DM: live delivery, receipts, threads, reactions, edits", async ({ browser }) => {
  const a = await signIn(browser, USER_A!);
  const b = await signIn(browser, USER_B!);
  const { body: meB } = await api<{ user: { id: string } }>(b, "/api/me");
  const created = await api<{ conversation: { id: string } }>(a, "/api/conversations", {
    method: "POST",
    body: { kind: "dm", userId: meB.user.id },
  });
  const again = await api<{ conversation: { id: string } }>(a, "/api/conversations", {
    method: "POST",
    body: { kind: "dm", userId: meB.user.id },
  });
  const dmId = created.body.conversation.id;
  expect(again.body.conversation.id).toBe(dmId); // idempotent dmKey

  await a.goto(`/dm/${dmId}`);
  await b.goto(`/dm/${dmId}`);
  const composerA = a.getByRole("textbox", { name: "Message" });
  await expect(composerA).toBeVisible();
  await expect(b.getByRole("textbox", { name: "Message" })).toBeVisible();
  await a.waitForTimeout(2000);

  const stamp = Date.now().toString(36);
  await composerA.fill(`root ${stamp}`);
  await composerA.press("Enter");
  await expect(b.getByText(`root ${stamp}`).first()).toBeVisible();
  await expect(a.getByText("Seen", { exact: true }).first()).toBeVisible();

  // Thread reply stays out of the root timeline.
  await b.locator(`[aria-label$=": root ${stamp}"]`).first().focus();
  await b.keyboard.press("r");
  const thread = b.locator('aside[aria-label="Thread"]');
  await thread.locator("textarea[data-composer]").fill(`reply ${stamp}`);
  await thread.locator("textarea[data-composer]").press("Enter");
  await expect(thread.locator(`[aria-label^="You: reply ${stamp}"]`)).toBeVisible();
  await expect(a.getByText(/1 repl/).first()).toBeVisible();
  await expect(a.locator("[data-root-chat]").getByText(`reply ${stamp}`)).toHaveCount(0);

  // Keyboard reaction and "E" to edit the last own message.
  await a.locator(`[aria-label^="You: root ${stamp}"]`).first().focus();
  await a.keyboard.press("+");
  await a.keyboard.press("Enter");
  await expect(b.getByRole("button", { name: /👍 1/ }).first()).toBeVisible();
  await composerA.click();
  await a.keyboard.press("e");
  const edit = a.getByRole("textbox", { name: "Edit message" });
  await edit.fill(`edited ${stamp}`);
  await edit.press("Enter");
  await expect(b.getByText(`edited ${stamp}`).first()).toBeVisible();

  // Reload keeps history; typing is never persisted.
  await b.reload();
  await expect(b.getByText(`edited ${stamp}`).first()).toBeVisible();
  await expect(b.getByText(/typing/)).toHaveCount(0);
});

test("Team: private channels, mentions, search scope", async ({ browser }) => {
  const a = await signIn(browser, USER_A!);
  const b = await signIn(browser, USER_B!);
  const stamp = Date.now().toString(36);
  const ws = await api<{ workspace: { id: string } }>(a, "/api/workspaces", {
    method: "POST",
    body: { name: `E2E ${stamp}` },
  });
  const wsId = ws.body.workspace.id;
  expect(
    (await api(a, `/api/workspaces/${wsId}/invites`, { method: "POST", body: { email: USER_B, role: "member" } })).status,
  ).toBe(201);
  const pub = await api<{ channel: { id: string } }>(a, `/api/workspaces/${wsId}/channels`, {
    method: "POST",
    body: { name: `general-${stamp}`, visibility: "public" },
  });
  const priv = await api<{ channel: { id: string } }>(a, `/api/workspaces/${wsId}/channels`, {
    method: "POST",
    body: { name: `secret-${stamp}`, visibility: "private" },
  });
  expect(pub.status).toBe(201);
  expect(priv.status).toBe(201);

  // Private channel: 404 (not 403) for a non-member; members cannot manage.
  expect((await api(b, `/api/conversations/${priv.body.channel.id}`)).status).toBe(404);
  expect(
    (await api(b, `/api/conversations/${pub.body.channel.id}`, { method: "PATCH", body: { name: "x" } })).status,
  ).toBe(403);

  await b.goto(`/w/${wsId}/channel/${pub.body.channel.id}`);
  await expect(b.getByRole("textbox", { name: "Message" })).toBeVisible();
  await a.goto(`/w/${wsId}/channel/${pub.body.channel.id}`);
  const composer = a.getByRole("textbox", { name: "Message" });
  const { body: meB } = await api<{ user: { displayName: string } }>(b, "/api/me");
  await composer.pressSequentially(`@${meB.user.displayName.slice(0, 3)}`, { delay: 40 });
  await expect(a.getByRole("option").first()).toBeVisible();
  await composer.press("Enter");
  await composer.pressSequentially(`ship ${stamp}`);
  await composer.press("Enter");
  await expect(b.getByText(`ship ${stamp}`).first()).toBeVisible();

  await b.goto("/inbox");
  await expect(b.getByText(/Mentioned you/).first()).toBeVisible();

  const personal = await api<{ hits: Array<{ conversation: { kind: string } }> }>(
    a,
    `/api/search?q=${stamp}`,
  );
  expect(personal.body.hits.filter((h) => h.conversation.kind === "channel")).toHaveLength(0);
  const scoped = await api<{ hits: unknown[] }>(a, `/api/search?q=${stamp}&workspaceId=${wsId}`);
  expect(scoped.body.hits.length).toBeGreaterThan(0);
});
