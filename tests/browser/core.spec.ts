import { test, expect } from "@playwright/test";

test("protected pages require authentication even when opened directly or refreshed", async ({
  page,
}) => {
  await page.goto("/subscriptions?status=active");
  await expect(page).toHaveURL(/\/login\?next=/);
  const returnTo = new URL(page.url()).searchParams.get("next");
  expect(returnTo).toBe("/subscriptions?status=active");
  await expect(
    page.getByRole("heading", { name: "A little more peace." }),
  ).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test("auth routes support direct loads, client navigation, and browser history", async ({
  page,
}) => {
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Less worry. More living." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/signup$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Less worry. More living." }),
  ).toBeVisible();
});

test("recovery and unknown routes render explicit pages", async ({ page }) => {
  await page.goto("/recovery");
  await expect(
    page.getByRole("heading", { name: "Forgot happens." }),
  ).toBeVisible();
  await page.goto("/not-a-route");
  await expect(
    page.getByRole("heading", { name: "We couldn’t find that page." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to sign in" })).toBeVisible();
});

test("auth inputs accept text on login, signup, recovery, and reset routes", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("ada@example.com");
  await page.getByLabel("Password").fill("example-password");
  await expect(page.getByLabel("Email address")).toHaveValue("ada@example.com");
  await expect(page.getByLabel("Password")).toHaveValue("example-password");

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Ada Example");
  await page.getByLabel("Email address").fill("ada@example.com");
  await page.getByLabel("Password").fill("example-password");
  await expect(page.getByLabel("Full name")).toHaveValue("Ada Example");

  await page.goto("/recovery");
  await page.getByLabel("Email address").fill("ada@example.com");
  await expect(page.getByLabel("Email address")).toHaveValue("ada@example.com");

  await page.goto("/reset-password");
  await page.getByLabel("New password", { exact: true }).fill("example-password");
  await page.getByLabel("Confirm new password", { exact: true }).fill("example-password");
  await expect(page.getByLabel("Confirm new password", { exact: true })).toHaveValue("example-password");
});

test("read-only preview exposes the shell without account or financial data", async ({
  page,
}) => {
  await page.goto("/preview");
  await expect(page.getByText("Read-only design preview - no account data or financial actions")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stay in control." })).toBeVisible();
});

test("auth and app shell fit phone and small-tablet widths without horizontal scrolling", async ({
  page,
}) => {
  const viewports = [
    { width: 280, height: 640 },
    { width: 320, height: 568 },
    { width: 360, height: 780 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 414, height: 896 },
    { width: 430, height: 932 },
    { width: 480, height: 800 },
    { width: 568, height: 320 },
    { width: 640, height: 360 },
    { width: 740, height: 360 },
    { width: 760, height: 812 },
    { width: 768, height: 1024 },
  ];
  for (const { width, height } of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto("/login");
    const authWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(authWidth, `auth page at ${width}px`).toBeLessThanOrEqual(width);
    await expect(page.getByRole("heading", { name: "Your money. Your rules." })).toBeVisible();

    await page.goto("/preview");
    const appWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(appWidth, `app shell at ${width}px`).toBeLessThanOrEqual(width);
    const mobileNavigation = page.getByRole("navigation", { name: "Mobile workspace navigation" });
    if (width <= 760) await expect(mobileNavigation).toBeVisible();
    else await expect(mobileNavigation).toBeHidden();
  }
});
