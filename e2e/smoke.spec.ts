import { expect, test } from "@playwright/test";

test.describe("Pulse smoke", () => {
  test("health endpoint responds", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in|login|pulse/i })).toBeVisible();
  });

  test("unauthenticated inbox redirects to login", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page).toHaveURL(/login/);
  });
});
