import { test, expect, type Page } from "@playwright/test";

// No browser API interception: requests traverse Next cookies, Express auth, and real PostgreSQL RLS.
test.skip(process.env.RETREST_RUN_ACCOUNT_INTEGRATION !== "true", "Run npm run test:ui for the disposable integration environment.");
const origin = process.env.TEST_ORIGIN!;
const cookieName = "__Host-retrest_account_access";
const call = (page: Page, path: string, method = "GET", data?: object) => page.request.fetch(path, {
  method, headers: { Origin: origin }, ...(data ? { data } : {}),
});
async function login(page: Page, email = "one@example.test") {
  await page.goto("/login?next=%2Fsettings");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("LongEnoughPassword!");
  const response = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/login");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  const loggedIn = await response;
  expect(loggedIn.status()).toBe(200);
  expect(await loggedIn.json()).not.toHaveProperty("session");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("button", { name: "Save name", exact: true })).toBeVisible();
}
test.beforeEach(async ({ page, request }) => {
  await page.context().route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  const reset = await request.post(process.env.RETREST_TEST_BACKEND_URL + "/_test/reset", {
    headers: { "X-Retrest-Test-Secret": process.env.RETREST_TEST_CONTROL_SECRET! },
  });
  expect(reset.ok()).toBe(true);
});

test("real routing rejects missing sessions and cross-site writes; login stores only HttpOnly credentials", async ({ page }) => {
  expect((await call(page, "/api/v1/me")).status()).toBe(401);
  expect((await call(page, "/api/health")).status()).toBe(200);
  const forged = await page.request.post("/api/auth/login", {
    headers: { Origin: "https://evil.example" }, data: { email: "one@example.test", password: "LongEnoughPassword!" },
  });
  expect(forged.status()).toBe(403);
  await login(page);
  const cookies = await page.context().cookies();
  const credentials = cookies.filter(cookie => cookie.name.startsWith("__Host-retrest_account_"));
  expect(credentials.filter(cookie => cookie.value)).toHaveLength(2);
  for (const cookie of credentials) {
    expect(cookie.httpOnly).toBe(true); expect(cookie.secure).toBe(true); expect(cookie.sameSite).toBe("Lax");
  }
  expect(await page.evaluate(() => document.cookie)).not.toContain("retrest_account");
  expect((await (await call(page, "/api/v1/me")).json()).user.email).toBe("one@example.test");
});

test("signup and code confirmation establish a real application session", async ({ page }) => {
  await page.goto("/signup?next=%2Fsettings");
  await page.getByLabel("Full name").fill("Test User");
  await page.getByLabel("Email address").fill("one@example.test");
  await page.getByLabel("Password", { exact: true }).fill("LongEnoughPassword!");
  await page.getByLabel("Confirm password", { exact: true }).fill("LongEnoughPassword!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("link", { name: "Enter the code from my email" }).click();
  await page.getByLabel("Email verification code").fill("00000000");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(page.locator(".toast").filter({ hasText: /Verification code is invalid/ })).toBeVisible();
  await page.getByLabel("Email verification code").fill("12345678");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  expect((await call(page, "/api/v1/profile")).status()).toBe(200);
});

test("email callbacks and recovery use the real session proxy", async ({ page }) => {
  await page.goto("/login?token_hash=confirm-one&type=signup&next=%2Fsettings");
  await expect(page).toHaveURL(/\/settings$/);
  expect((await call(page, "/api/v1/me")).status()).toBe(200);
  await call(page, "/api/auth/logout", "POST");
  await page.goto("/reset-password?token_hash=confirm-one&type=recovery");
  await expect(page.getByText("Confirming your sign-in link…")).not.toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill("ChangedPassword123!");
  await page.getByLabel("Confirm password", { exact: true }).fill("ChangedPassword123!");
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Password updated." })).toBeVisible();
});

test("expired access refreshes cookies and logout revokes the SQL session", async ({ page, request }) => {
  await login(page);
  const current = (await page.context().cookies()).find(cookie => cookie.name === cookieName)!;
  await page.context().addCookies([{ ...current, value: "expired" }]);
  expect((await call(page, "/api/v1/me")).status()).toBe(200);
  expect((await page.context().cookies()).find(cookie => cookie.name === cookieName)?.value).toBe("one");
  expect((await page.context().cookies()).find(cookie => cookie.name.endsWith("account_refresh"))?.value).toBe("rotated-one");
  const state = await request.get(process.env.RETREST_TEST_BACKEND_URL + "/_test/state", {
    headers: { "X-Retrest-Test-Secret": process.env.RETREST_TEST_CONTROL_SECRET! },
  });
  expect((await state.json()).refreshCount).toBe(1);
  expect((await call(page, "/api/auth/logout", "POST")).status()).toBe(200);
  expect((await call(page, "/api/v1/me")).status()).toBe(401);
  await page.context().addCookies([current]);
  expect((await call(page, "/api/v1/me")).status()).toBe(401);
});

test("trusted browser registration strips the token; removal revokes account access", async ({ page }) => {
  await login(page);
  const registered = await call(page, "/api/v1/devices", "POST", { name: "Integration browser" });
  expect(registered.status()).toBe(201);
  const body = await registered.json();
  expect(body).not.toHaveProperty("trust_token");
  expect((await page.context().cookies()).find(cookie => cookie.name.endsWith("account_device"))?.httpOnly).toBe(true);
  expect((await call(page, "/api/v1/devices/" + body.device.id, "DELETE")).status()).toBe(200);
  expect((await call(page, "/api/v1/me")).status()).toBe(401);
});

test("account isolation, invitations, support and downloads traverse the authenticated proxy", async ({ page, browser }) => {
  await login(page);
  const created = await call(page, "/api/v1/subscriptions", "POST", {
    name: "Shared music", merchant_descriptor: "MUSIC", amount_minor: 100, currency: "NGN", next_billing_date: "2026-12-01",
  });
  expect(created.status()).toBe(201);
  const subscription = (await created.json()).subscription;
  const second = await browser.newContext({ baseURL: origin });
  const invitee = await second.newPage();
  try {
    await login(invitee, "two@example.test");
    expect((await call(invitee, "/api/v1/subscriptions/" + subscription.id, "PATCH", { active: false })).status()).toBe(404);
    const pooled = await call(page, "/api/v1/pools", "POST", { subscription_id: subscription.id, name: "Friends", members: [
      { display_name: "One", email: "one@example.test", share_amount: 50 },
      { display_name: "Two", email: "two@example.test", share_amount: 50 },
    ] });
    expect(pooled.status()).toBe(201);
    const pool = (await pooled.json()).pool;
    const detail = await (await call(page, "/api/v1/pools/" + pool.id)).json();
    const member = detail.members.find((entry: { invited_email: string }) => entry.invited_email === "two@example.test");
    const invited = await call(page, "/api/v1/pools/" + pool.id + "/invites", "POST", { member_id: member.id });
    const invitation = await invited.json();
    expect((await call(invitee, "/api/v1/invites/" + invitation.token + "/accept", "POST")).status()).toBe(200);
    const contribution = await invitee.request.post("/api/v1/pools/" + pool.id + "/contributions", {
      headers: { Origin: origin, "Idempotency-Key": "integration-contribution-key" }, data: {},
    });
    expect(contribution.status()).toBe(202);
    expect((await contribution.json()).contribution.status).toBe("PENDING");
    const support = await page.request.post("/api/v1/support/threads", { headers: { Origin: origin, "Idempotency-Key": "integration-support-key" }, data: { subject: "Test", body: "Integration message" } });
    expect(support.status()).toBe(201);
    const thread = (await support.json()).thread;
    expect((await call(invitee, "/api/v1/support/threads/" + thread.id)).status()).toBe(404);
    const csv = await call(page, "/api/v1/export?month=2026-11&format=csv");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
  } finally { await second.close(); }
});
