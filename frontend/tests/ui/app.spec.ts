import { test, expect } from "@playwright/test";

let disposableBackend = false;

test.beforeEach(async ({ context }) => {
  // Keep these UI checks independent of the external font service.
  await context.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
});

test.beforeAll(async ({ request, baseURL }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  expect((await health.json()).test_instance, "Browser demo tests require an in-memory API running in test mode.").toBe(true);
  disposableBackend = true;
  const headers = { Origin: baseURL ?? "http://localhost:3000" };
  await request.post("/api/session", { headers });
  const reset = await request.post("/api/demo/reset", { headers });
  expect(reset.ok()).toBe(true);
});
test.afterAll(async ({ request, baseURL }) => {
  if (!disposableBackend) return;
  const headers = { Origin: baseURL ?? "http://localhost:3000" };
  await request.post("/api/session", { headers });
  await request.post("/api/demo/reset", { headers });
});

test("desktop command center, merchant switches, receipt exports, and invite flow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/shield?demo=1");
  await expect(
    page.getByRole("heading", { name: "Stay in control." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/shield-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("switch", { name: "Pause Spotify", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Activate Spotify", exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("switch", { name: "Activate Spotify", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Pause Spotify", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Try a live demo" }).click();
  for (const [scenario, result] of [
    ["The everyday payment", "Payment approved."],
    ["The kill switch", "Your money stayed put."],
    ["The sneaky price hike", "Your money stayed put."],
  ]) {
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/api/demo") && r.request().method() === "POST",
    );
    await page.locator(".demo-scenario").filter({ hasText: scenario }).click();
    await response;
    await expect(page.locator(".demo-result")).toContainText(result);
  }
  await page.screenshot({
    path: "test-results/demo-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("navigation", { name: "Dashboard navigation" })
    .getByRole("link", { name: "Pools", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Share the plan." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/pools-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create a pool", exact: true })
    .click();
  await page.locator('[name="pool_name"]').fill("The listening lounge");
  await page.locator('[name="name_1"]').fill("Amina Bello");
  await page.locator('[name="email_1"]').fill("amina@example.com");
  await page.locator('[name="name_2"]').fill("Femi Dada");
  await page.locator('[name="email_2"]').fill("femi@example.com");
  await page
    .getByRole("button", { name: "Create pool & get invite link" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your pool is ready." }),
  ).toBeVisible();
  const invite = await page.locator(".invite-link-text").innerText();
  const invitePage = await page.context().newPage();
  await invitePage.goto(invite);
  await invitePage.getByRole("textbox").fill("amina@example.com");
  await invitePage
    .getByRole("button", { name: "Simulate my contribution" })
    .click();
  await expect(invitePage.locator(".invite-success")).toContainText(
    "demo contribution is in",
  );
  await invitePage.close();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("navigation", { name: "Dashboard navigation" })
    .getByRole("link", { name: "Insights", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Make money moves." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/insights-desktop.png",
    fullPage: true,
  });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export receipt pack" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await page.getByLabel("Export receipt format").selectOption("pdf");
  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export receipt pack" }).click();
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
  expect(errors).toEqual([]);
});

test("mobile has three tabs, no page overflow, and usable simulator", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shield?demo=1");
  await expect(
    page.getByRole("heading", { name: "Stay in control." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page
      .getByRole("navigation", { name: "Dashboard navigation" })
      .getByRole("link"),
  ).toHaveCount(3);
  await page.screenshot({
    path: "test-results/shield-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Try a live demo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Close dialog" }).click();
  for (const [tab, heading] of [
    ["Pools", "Share the plan."],
    ["Insights", "Make money moves."],
  ]) {
    await page
      .getByRole("navigation", { name: "Dashboard navigation" })
      .getByRole("link", { name: tab, exact: true })
      .click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("landing preview feedback and simulator navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Your subscriptions.*Your money.*Your rules/,
    }),
  ).toBeVisible();
  await page.getByRole("switch", { name: "Pause Netflix preview" }).click();
  await expect(page.locator(".preview-event")).toContainText("Netflix paused");
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/landing-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Website navigation" })
    .getByRole("link", { name: "Demo Simulator" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Live charge simulator" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("business report, help drawer, and mobile subscription controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shield?demo=1");
  await page
    .getByRole("switch", { name: "Pause Spotify", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Activate Spotify", exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("switch", { name: "Activate Spotify", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Pause Spotify", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Chat with us", exact: true }).click();
  const chat = page.getByRole("dialog", { name: "Chat with us" });
  await chat.getByRole("button", { name: "A blocked payment" }).click();
  await expect(
    chat.getByRole("article", { name: "Help article" }),
  ).toContainText("A payment can be blocked");
  await expect(
    chat.getByRole("button", { name: "Send message" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(chat).not.toBeVisible();
  await page
    .getByRole("navigation", { name: "Dashboard navigation" })
    .getByRole("link", { name: "Insights", exact: true })
    .click();
  await page.getByRole("button", { name: "Generate spend summary" }).click();
  const summary = page.getByRole("dialog", { name: "Monthly spend summary" });
  await summary
    .getByRole("button", { name: "Load monthly report", exact: true })
    .click();
  await expect(summary.locator(".summary-totals")).toBeVisible();
  await expect(
    summary.getByText("Email delivery is not connected.", { exact: true }),
  ).toBeVisible();
  await expect(
    summary.getByRole("button", { name: "Send monthly summary" }),
  ).toBeDisabled();
  await expect(summary.locator('a[href^="mailto:"]')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/summary-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      "/",
      "/shield?demo=1",
      "/pools?demo=1",
      "/insights?demo=1",
      "/login",
      "/device-binding",
    ]) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + " at " + width,
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
