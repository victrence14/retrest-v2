import { test, expect } from "@playwright/test";

test("manifest, PNG icons and a controlling service worker meet Chromium installability checks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your money. Your rules." }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  const manifest = await (await page.request.get("/manifest.json")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.name).toContain("RETREST");
  for (const icon of manifest.icons) {
    const response = await page.request.get(icon.src);
    expect(response.ok()).toBe(true);
    const png = await response.body();
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.enable");
  await expect
    .poll(
      async () =>
        (await cdp.send("Page.getInstallabilityErrors")).installabilityErrors,
    )
    .toEqual([]);
});

test("the application shell reloads offline and private API responses are absent from caches", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  const cachedUrls = await page.evaluate(async () => {
    const lists = await Promise.all(
      (await caches.keys()).map(async (name) =>
        (await (await caches.open(name)).keys()).map((request) => request.url),
      ),
    );
    return lists.flat();
  });
  expect(cachedUrls.length).toBeGreaterThan(0);
  expect(cachedUrls.some((url) => /\/api\/|supabase/.test(url))).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your money. Your rules." }),
  ).toBeVisible();
  await expect(page.getByText("You’re offline.")).toBeVisible();
  await context.setOffline(false);
});

