import { test, expect, type Page } from "@playwright/test";
import { mockAccount } from "./account-fixture";

const runtimeErrors = new WeakMap<Page, string[]>();
const notice = (page: Page, text: string) => page.locator(".toast-viewport .toast").filter({ hasText: text });

test.beforeEach(async ({ page, context }) => {
  // Keep these UI checks independent of the external font service.
  await context.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && /hydration|hydrating/i.test(message.text())) errors.push(message.text()); });
});
test.afterEach(({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });

test("system appearance responds to device changes; manual choices survive navigation, reloads and synchronize tabs", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Use light mode" }).click();
  await expect(notice(page, "Light mode enabled.")).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("link", { name: /Create an account/ }).click();
  await expect(page).toHaveURL(/\/signup/);
  await expect(notice(page, "Light mode enabled.")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Use light mode" })).toHaveAttribute("aria-pressed", "true");
  const other = await page.context().newPage();
  await other.goto("/");
  await other.getByRole("button", { name: "Use dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await other.close();
});

test("themes work when browser storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage unavailable", "SecurityError"); } }));
  await page.goto("/login");
  await page.getByRole("button", { name: "Use light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(notice(page, "Light mode enabled.")).toBeVisible();
});

test("signup validation, OTP failure, resend cooldown and successful verification show appropriate feedback", async ({ page }) => {
  const fixture = await mockAccount(page);
  await page.clock.install();
  await page.goto("/signup?next=%2Fsettings");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(notice(page, "Check the highlighted fields")).toHaveAttribute("role", "alert");
  expect(fixture.requests.filter(request => request.path === "/api/auth/signup")).toHaveLength(0);
  await page.getByLabel("Full name").fill("Amina Bello");
  await page.getByLabel("Email address").fill("AMINA@example.test");
  await page.getByLabel("Password", { exact: true }).fill("LongEnoughPassword!");
  await page.getByLabel("Confirm password", { exact: true }).fill("LongEnoughPassword!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox." })).toBeVisible();
  await expect(notice(page, "Signup received.")).toHaveAttribute("role", "status");
  expect(fixture.requests.find(request => request.path === "/api/auth/signup")?.body?.email).toBe("amina@example.test");
  await page.getByRole("link", { name: "Enter the code from my email" }).click();
  await expect(page.getByLabel("Email address")).toHaveValue("amina@example.test");
  await expect(page.getByRole("button", { name: /Resend email in/ })).toBeDisabled();
  await page.getByLabel("Email verification code").fill("12");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(page.locator("#otp-error")).toContainText("complete verification code");
  expect(fixture.requests.filter(request => request.path === "/api/auth/verify")).toHaveLength(0);
  fixture.replyNext("POST", "/api/auth/verify", 400, { error: "Verification code is invalid or expired." });
  await page.getByLabel("Email verification code").fill("012345");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(notice(page, "Verification code is invalid or expired.")).toHaveAttribute("role", "alert");
  await expect(page).toHaveURL(/\/otp/);
  await page.clock.runFor(61000);
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(notice(page, "A new verification email")).toBeVisible();
  await expect(page.getByLabel("Email verification code")).toHaveValue("");
  await page.getByLabel("Email verification code").fill("01234567");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(notice(page, "Email verified. You are signed in.")).toBeVisible();
  const verified = fixture.requests.filter(request => request.path === "/api/auth/verify").at(-1);
  expect(verified?.body?.type).toBe("signup");
  expect(verified?.body?.token).toHaveLength(8);
});

test("login failures keep the form open; successful login feedback survives the redirect", async ({ page }) => {
  const fixture = await mockAccount(page);
  fixture.replyNext("POST", "/api/auth/login", 401, { error: "Email or password is incorrect." });
  await page.goto("/login?next=%2Fsettings");
  await page.getByLabel("Email address").fill("amina@example.test");
  await page.getByLabel("Password", { exact: true }).fill("LongEnoughPassword!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(notice(page, "Email or password is incorrect.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(notice(page, "You have logged in successfully.")).toBeVisible();
});

test("recovery codes lead to password reset, which reports failures and confirmed success", async ({ page }) => {
  const fixture = await mockAccount(page);
  await page.goto("/forgot-password?next=%2Fsettings");
  await page.getByLabel("Email address").fill("amina@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(notice(page, "Password reset requested.")).toBeVisible();
  await page.getByRole("link", { name: "Enter the code from my email" }).click();
  await expect(page).toHaveURL(/intent=recovery/);
  await page.getByLabel("Email verification code").fill("012345");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(page).toHaveURL(/\/reset-password/);
  await expect(notice(page, "Code verified. Choose your new password.")).toBeVisible();
  expect(fixture.requests.find(request => request.path === "/api/auth/verify")?.body?.type).toBe("recovery");
  await page.getByLabel("New password", { exact: true }).fill("short");
  await page.getByLabel("Confirm password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.locator("#password-error")).toContainText("12 characters");
  expect(fixture.requests.filter(request => request.path === "/api/auth/password")).toHaveLength(0);
  await page.getByLabel("New password", { exact: true }).fill("AnotherLongPassword!");
  await page.getByLabel("Confirm password", { exact: true }).fill("AnotherLongPassword!");
  fixture.replyNext("PATCH", "/api/auth/password", 503, { error: "The password service is unavailable." });
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(notice(page, "The password service is unavailable.")).toBeVisible();
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Password updated." })).toBeVisible();
  await expect(notice(page, "Your password has been updated successfully.")).toBeVisible();
});

test("trusted browser registration requires acknowledgement and announces confirmed success after navigation", async ({ page }) => {
  const fixture = await mockAccount(page);
  await fixture.authenticate();
  await page.goto("/device-binding?next=%2Fsettings");
  await page.getByRole("button", { name: "Trust this browser", exact: true }).click();
  await expect(notice(page, "Check the highlighted fields")).toBeVisible();
  expect(fixture.requests.filter(request => request.path === "/api/v1/devices" && request.method === "POST")).toHaveLength(0);
  await page.getByLabel("Browser name").fill("Amina’s browser");
  await page.getByRole("checkbox").check();
  fixture.replyNext("POST", "/api/v1/devices", 503, { error: "Could not register this browser." });
  await page.getByRole("button", { name: "Trust this browser", exact: true }).click();
  await expect(notice(page, "Could not register this browser.")).toBeVisible();
  await expect(page).toHaveURL(/\/device-binding/);
  await page.getByRole("button", { name: "Trust this browser", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(notice(page, "This browser has been added to your trusted devices.")).toBeVisible();
});

test("account appearance waits for saved settings and keeps the current theme on a failed save", async ({ page }) => {
  const fixture = await mockAccount(page, "dark");
  await fixture.authenticate();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/settings");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  fixture.replyNext("PATCH", "/api/v1/settings", 503, { error: "Could not save appearance." });
  await page.locator(".topbar").getByRole("button", { name: "Use light mode" }).click();
  await expect(notice(page, "Could not save appearance.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator(".topbar").getByRole("button", { name: "Use light mode" }).click();
  await expect(notice(page, "Light mode enabled.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(fixture.settings.theme).toBe("light");
  await expect(page.locator(".appearance-panel").getByRole("button", { name: "Use light mode" })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/settings-light.png", fullPage: true });
  await page.getByRole("button", { name: "Follow device settings" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(fixture.settings.theme).toBe("system");
});

test("modal action feedback can be focused and dismissed; notifications remain visible after closing the dialog", async ({ page }) => {
  const fixture = await mockAccount(page);
  await fixture.authenticate();
  await page.goto("/settings");
  await page.getByRole("button", { name: /Notifications/ }).click();
  const dialog = page.getByRole("dialog", { name: "Notifications" });
  await dialog.getByRole("button", { name: "Mark all read" }).click();
  const toast = dialog.locator(".toast").filter({ hasText: "Notifications marked as read." });
  await expect(toast).toBeVisible();
  const bounds = await toast.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await toast.getByRole("button", { name: "Dismiss notification" }).focus();
  await page.waitForTimeout(5200);
  await expect(toast).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(toast).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.locator(".topbar").getByRole("button", { name: "Use dark mode" }).click();
  await expect(notice(page, "Dark mode enabled.")).toBeVisible();
  await page.getByRole("button", { name: /Notifications/ }).click();
  await expect(page.getByRole("dialog").locator(".toast")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(notice(page, "Dark mode enabled.")).toBeVisible();
});

test("confirmation callbacks consume a link once and keep partial email changes on the confirmation screen", async ({ page }) => {
  const fixture = await mockAccount(page);
  fixture.replyNext("POST", "/api/auth/verify", 202, { confirmation_required: true });
  await page.goto("/login?token_hash=fixture-confirmation&type=email_change");
  await expect(page.getByText("This email confirmation is recorded. Confirm the other address to finish your email change.")).toBeVisible();
  await expect(notice(page, "Email confirmation recorded.")).toBeVisible();
  expect(fixture.requests.filter(request => request.path === "/api/auth/verify")).toHaveLength(1);
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/login?token_hash=fixture-confirmation&type=signup&next=%2Fsettings");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(notice(page, "Email verification successful.")).toBeVisible();
  expect(fixture.requests.filter(request => request.path === "/api/auth/verify")).toHaveLength(2);
});

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 768, 1440]) {
    test(theme + " mode has accessible controls and no horizontal overflow at " + width + "px", async ({ page }) => {
      const fixture = await mockAccount(page);
      await fixture.authenticate();
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => localStorage.setItem("retrest.appearance", value), theme);
      for (const route of ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/otp", "/device-binding", "/settings", "/shield?demo=1"]) {
        await page.goto(route);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const control = page.getByRole("button", { name: "Use " + theme + " mode" }).first();
        await expect(control).toBeVisible();
        await expect(control).toHaveAttribute("aria-pressed", "true");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + " at " + width).toBe(true);
        if (route === "/settings") {
          await page.getByRole("button", { name: "Save name", exact: true }).click();
          const saved = notice(page, "Your name is saved.");
          await expect(saved).toBeVisible();
          const [toastBounds, navigationBounds] = await Promise.all([saved.boundingBox(), page.locator(".bottom-nav").boundingBox()]);
          expect(toastBounds!.y + toastBounds!.height, "Toast should leave the dashboard navigation accessible").toBeLessThan(navigationBounds!.y);
        }
        if ((route === "/login" && width === 390) || (route === "/" && width === 1440))
          await page.screenshot({ path: "test-results/" + (route === "/" ? "landing" : "login") + "-" + theme + "-" + width + ".png", fullPage: true });
      }
    });
  }
}
