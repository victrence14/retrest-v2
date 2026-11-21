import { test, expect, type Page } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Dashboard } from '../../archive/next-app/src/lib/types';
import { parseBusinessExport, businessTotals } from '../../archive/next-app/src/features/insights/business-export';
import { money } from '../../archive/next-app/src/lib/format';

async function state(page: Page): Promise<Dashboard> { const response = await page.request.get('/api/state'); expect(response.ok()).toBe(true); return response.json(); }
async function feature(page: Page, name: string) { await page.getByRole('navigation', { name: 'FE2 feature verification' }).getByRole('button', { name, exact: true }).click(); }
async function plan(page: Page, name: string, amount = 10001, business = false) {
  const descriptor = `FE2 ${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
  const response = await page.request.post('/api/subscriptions', { data: { merchant_name: name, merchant_descriptor: descriptor, expected_amount: amount, currency: 'NGN', next_billing_date: new Date().toISOString().slice(0, 10), is_business_expense: business } });
  expect(response.ok()).toBe(true);
  const dashboard: Dashboard = await response.json();
  const subscription = dashboard.subscriptions.find(item => item.merchant_descriptor === descriptor)!;
  expect(subscription).toBeTruthy();
  return { dashboard, subscription };
}
async function screenshot(page: Page, name: string, project: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: join(process.env.FE2_EVIDENCE_DIR!, `${name}-${project}.png`), fullPage: true });
}

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = []; pageErrors.set(page, errors); page.on('pageerror', error => errors.push(error.message));
  expect(process.env.FE2_DISPOSABLE_APP).toBeTruthy();
  await page.request.post('/api/session');
  const marker = await page.request.get('/fe2-verification');
  expect(await marker.text()).toContain('FE2 integration verification');
  const reset = await page.request.post('/api/demo/reset');
  expect(reset.ok()).toBe(true);
});

test.afterEach(async ({ page }) => { expect(pageErrors.get(page), 'Unexpected browser runtime errors').toEqual([]); });

test('pool shares, client validation, confirmed contributions and fallback survive reload', async ({ page }, info) => {
  const { dashboard, subscription } = await plan(page, 'Minor unit team plan');
  await page.goto('/fe2-verification');
  await page.getByRole('button', { name: 'Create a pool', exact: true }).click();
  await page.getByLabel('Eligible subscription').selectOption(subscription.id);
  await page.getByLabel('Pool name').fill('Exact team allocation');
  await page.getByRole('button', { name: 'Add member' }).click();
  const editors = page.locator('.fe2-pool-member-editor');
  await editors.nth(1).getByLabel('Name', { exact: true }).fill('Member One');
  await editors.nth(1).getByLabel('Email', { exact: true }).fill(dashboard.user.email.toUpperCase());
  await editors.nth(2).getByLabel('Name', { exact: true }).fill('Member Two');
  await editors.nth(2).getByLabel('Email', { exact: true }).fill('member-two@example.com');
  expect(await page.getByLabel('NGN share', { exact: true }).evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).toEqual(['33.34', '33.34', '33.33']);
  let posts = 0;
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/pools') posts++; });
  await page.getByRole('button', { name: 'Create pool & get invite link' }).click();
  await expect(page.getByRole('region', { name: 'Pool creation' }).getByRole('alert')).toContainText('already in the pool'); expect(posts).toBe(0);
  await editors.nth(1).getByLabel('Email', { exact: true }).fill('member-one@example.com');
  await page.getByRole('radio', { name: 'Custom shares' }).check();
  await editors.nth(1).getByLabel('NGN share').fill('0');
  await page.getByRole('button', { name: 'Create pool & get invite link' }).click();
  await expect(page.getByRole('region', { name: 'Pool creation' }).getByRole('alert')).toContainText('positive share'); expect(posts).toBe(0);
  await editors.nth(1).getByLabel('NGN share').fill('33.33');
  await page.getByRole('button', { name: 'Create pool & get invite link' }).click();
  await expect(page.getByRole('region', { name: 'Pool creation' }).getByRole('alert')).toContainText('exact plan total'); expect(posts).toBe(0);
  await editors.nth(1).getByLabel('NGN share').fill('33.34');
  let release!: () => void;
  const gate = new Promise<void>(done => { release = done; });
  await page.route('**/api/pools', async route => { const response = await route.fetch(); await gate; await route.fulfill({ response }); });
  await page.getByRole('button', { name: 'Create pool & get invite link' }).click();
  await expect(page.getByRole('button', { name: 'Confirming…' })).toBeDisabled();
  await page.locator('.fe2-pool-editor').evaluate((form: HTMLFormElement) => form.requestSubmit());
  expect(posts).toBe(1); release();
  await expect(page.getByRole('heading', { name: 'Exact team allocation' })).toBeVisible();
  await page.unroute('**/api/pools');
  await page.reload();
  const card = page.locator('.fe2-pool-card').filter({ has: page.getByRole('heading', { name: 'Exact team allocation' }) });
  const fallback = card.getByRole('switch', { name: 'Host fallback for Exact team allocation' });
  await expect(fallback).toBeChecked(); await fallback.click(); await expect(fallback).not.toBeChecked();
  await page.reload(); await expect(fallback).not.toBeChecked();
  await card.getByRole('button', { name: 'Simulate contribution for Member One', exact: true }).click();
  await expect(card).toContainText('Demo contribution confirmed by the server.');
  const persisted = (await state(page)).pools.find(pool => pool.subscription_id === subscription.id)!;
  expect(persisted.members.reduce((total, member) => total + member.share_amount, 0)).toBe(10001);
  expect(persisted.pool_balance).toBe(3334); expect(persisted.fallback_enabled).toBe(0);
  await page.reload(); await expect(card).toContainText('Paid · demo');
  await screenshot(page, 'pools', info.project.name);
});

test('pool server rejection reconciles an already-created pool before retrying', async ({ page }) => {
  const { dashboard, subscription } = await plan(page, 'Concurrent pool plan', 101);
  await page.goto('/fe2-verification'); await page.getByRole('button', { name: 'Create a pool', exact: true }).click();
  await page.getByLabel('Eligible subscription').selectOption(subscription.id); await page.getByLabel('Pool name').fill('My attempted pool');
  const guest = page.locator('.fe2-pool-member-editor').nth(1);
  await guest.getByLabel('Name', { exact: true }).fill('Second member'); await guest.getByLabel('Email', { exact: true }).fill('second@example.com');
  const created = await page.request.post('/api/pools', { data: { subscription_id: subscription.id, name: 'Confirmed concurrent pool', members: [{ name: dashboard.user.name, email: dashboard.user.email, share_amount: 51 }, { name: 'Second member', email: 'second@example.com', share_amount: 50 }] } });
  expect(created.ok()).toBe(true);
  await page.getByRole('button', { name: 'Create pool & get invite link' }).click();
  await expect(page.getByRole('region', { name: 'Pool creation' }).getByRole('alert')).toContainText('already has a pool');
  await page.getByRole('button', { name: 'Recheck server state before retrying' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmed concurrent pool' })).toBeVisible();
  expect((await state(page)).pools.filter(pool => pool.subscription_id === subscription.id)).toHaveLength(1);
});

test('invite return context, rejected email, confirmed demo result and idempotent rechecks', async ({ page }, info) => {
  const { dashboard, subscription } = await plan(page, 'Invite team plan', 101);
  const created = await page.request.post('/api/pools', { data: { subscription_id: subscription.id, name: 'Invited team', members: [{ name: dashboard.user.name, email: dashboard.user.email, share_amount: 51 }, { name: 'Invited member', email: 'invited@example.com', share_amount: 50 }] } });
  expect(created.ok()).toBe(true); const result = await created.json(); const path = `/invite/${result.invite_token}`;
  await page.goto(path);
  await expect(page.getByText(/does not verify account ownership/)).toBeVisible();
  const login = page.getByRole('link', { name: 'Open login and return to this invite' });
  await expect(login).toHaveAttribute('href', `/login?next=${encodeURIComponent(path)}`);
  await login.click();
  const password = page.getByLabel('Password', { exact: true });
  // The existing shell form can render before its controlled inputs hydrate.
  // Wait for a visible control to react before entering the return-flow details.
  await expect(async () => {
    if (await password.getAttribute('type') === 'password') await page.getByRole('button', { name: 'Show password', exact: true }).click();
    await expect(password).toHaveAttribute('type', 'text', { timeout: 500 });
  }).toPass({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByLabel('Email address').fill('invited@example.com'); await password.fill('DemoPass123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/device-binding\\?next=${encodeURIComponent(path)}$`));
  await page.getByLabel('Verification digit 1', { exact: true }).fill('123456');
  await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Verify & trust device' }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await page.getByLabel('Your invited email address').fill('unlisted@example.com'); await page.getByRole('button', { name: 'Simulate my contribution' }).click();
  await expect(page.getByRole('region', { name: 'Pool invitation' }).getByRole('alert')).toContainText('Ask your host'); await expect(page.locator('.invite-success')).toHaveCount(0);
  await page.getByLabel('Your invited email address').fill(' INVITED@EXAMPLE.COM ');
  let release!: () => void; const gate = new Promise<void>(done => { release = done; }); let submissions = 0;
  await page.route(`**/api/invites/${result.invite_token}`, async route => { submissions++; const response = await route.fetch(); await gate; await route.fulfill({ response }); });
  await page.getByRole('button', { name: 'Simulate my contribution' }).click();
  await expect(page.getByRole('button', { name: 'Confirming with the server…' })).toBeDisabled(); await expect(page.locator('.invite-success')).toHaveCount(0);
  await page.locator('.fe2-invites form').evaluate((form: HTMLFormElement) => form.requestSubmit()); expect(submissions).toBe(1); release();
  await expect(page.locator('.invite-success')).toContainText('demo contribution is in'); await page.unroute(`**/api/invites/${result.invite_token}`);
  await page.getByRole('button', { name: 'Recheck demo contribution' }).click(); await expect(page.locator('.invite-success')).toContainText('already in the pool');
  await page.reload(); await page.getByLabel('Your invited email address').fill('invited@example.com'); await page.getByRole('button', { name: 'Simulate my contribution' }).click();
  await expect(page.locator('.invite-success')).toContainText('already in the pool');
  expect((await state(page)).pools.find(pool => pool.subscription_id === subscription.id)!.pool_balance).toBe(50);
  await screenshot(page, 'invite', info.project.name);
});

test('transaction reasons, funding detail and authenticated PDFs exclude declined receipts', async ({ page, playwright }, info) => {
  const approval = await (await page.request.post('/api/demo', { data: { scenario: 'normal' } })).json();
  const decline = await (await page.request.post('/api/demo', { data: { scenario: 'hike' } })).json();
  await page.goto('/transactions');
  await expect(page.getByText('Latest 100 records. Filters and pages apply to this snapshot.')).toBeVisible();
  await page.getByRole('button', { name: `View details for ${approval.merchant_name} ${approval.transaction_id}`, exact: true }).click();
  const detail = page.getByRole('dialog', { name: `Transaction details for ${approval.merchant_name}` });
  await expect(detail).toContainText('Wallet-funded remainder');
  const view = page.waitForResponse(response => response.url().includes(`/api/receipts/${approval.transaction_id}?format=pdf`));
  await detail.getByRole('button', { name: 'View receipt', exact: true }).click();
  const viewed = await view; expect((await viewed.request().allHeaders()).cookie).toContain('retrest_session=');
  await expect(detail.getByTitle('Authenticated receipt PDF')).toHaveAttribute('src', /^blob:/);
  const download = page.waitForEvent('download'); await detail.getByRole('button', { name: 'Download receipt PDF' }).click();
  const pdf = await download; expect(pdf.suggestedFilename()).toBe(`retrest-receipt-${approval.transaction_id}.pdf`); expect((await readFile((await pdf.path())!)).subarray(0, 4).toString()).toBe('%PDF');
  await screenshot(page, 'transaction-detail', info.project.name);
  await detail.getByRole('button', { name: 'Close transaction details' }).click();
  await page.getByRole('button', { name: `View details for ${decline.merchant_name} ${decline.transaction_id}`, exact: true }).click();
  await expect(detail).toContainText('Price Hike Blocked'); await expect(detail.getByRole('button', { name: /receipt/i })).toHaveCount(0);
  const missingReceipt = await page.request.get(`/api/receipts/${decline.transaction_id}?format=pdf`); expect(missingReceipt.status()).toBe(404);
  const anonymous = await playwright.request.newContext({ baseURL: process.env.TEST_ORIGIN });
  try { expect((await anonymous.get(`/api/receipts/${approval.transaction_id}?format=pdf`)).status()).toBe(401); } finally { await anonymous.dispose(); }
});

test('insights use complete business exports beyond 100 records and show unavailable email delivery', async ({ page }, info) => {
  const { dashboard, subscription } = await plan(page, 'Complete export audit', 101, true);
  const month = new Date().toISOString().slice(0, 7);
  const baseline = parseBusinessExport(await (await page.request.get(`/api/export?month=${month}&format=csv`)).text(), month);
  for (let index = 0; index < 110; index++) {
    const raw = JSON.stringify({ authorization_id: `fe2_export_${info.project.name}_${index}`, provider_card_id: dashboard.card.provider_card_id, merchant_descriptor: subscription.merchant_descriptor, amount: 101, currency: 'NGN' });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', process.env.FE2_TEST_WEBHOOK_SECRET!).update(`${timestamp}.${raw}`).digest('hex');
    const response = await page.request.post('/api/webhooks/card-auth', { data: raw, headers: { 'Content-Type': 'application/json', 'x-retrest-timestamp': timestamp, 'x-retrest-signature': signature } });
    expect(response.ok()).toBe(true);
  }
  expect((await state(page)).transactions).toHaveLength(100);
  const complete = parseBusinessExport(await (await page.request.get(`/api/export?month=${month}&format=csv`)).text(), month);
  expect(complete.length).toBe(baseline.length + 110);
  expect(businessTotals(complete).NGN - businessTotals(baseline).NGN).toBe(11110);
  await page.goto('/fe2-verification'); await feature(page, 'Insights');
  const vault = page.getByRole('region', { name: 'Business expense vault' });
  await expect(vault.locator('.fe2-business-totals')).toContainText(money(businessTotals(complete).NGN, 'NGN', true));
  await expect(vault.locator('.fe2-vault-footer')).toContainText(`${complete.length} in the complete month`);
  const flags = (await state(page)).subscriptions.filter(item => item.needs_review);
  await expect(page.locator('.fe2-insight-overview .text-button')).toHaveCount(flags.length);
  const csvDownload = page.waitForEvent('download'); await vault.getByRole('button', { name: 'Export receipt pack' }).click();
  const csv = await csvDownload; expect(parseBusinessExport(await readFile((await csv.path())!, 'utf8'), month)).toHaveLength(complete.length);
  await vault.getByLabel('Export receipt format').selectOption('pdf'); const pdfDownload = page.waitForEvent('download'); await vault.getByRole('button', { name: 'Export receipt pack' }).click();
  expect((await readFile((await (await pdfDownload).path())!)).subarray(0, 4).toString()).toBe('%PDF');
  await vault.getByLabel('Business expense currency').selectOption('USD'); await expect(vault.locator('tbody')).not.toContainText('Complete export audit');
  await page.getByRole('button', { name: 'Open monthly business report' }).click(); await page.getByRole('button', { name: 'Load monthly report', exact: true }).click();
  await expect(page.locator('.summary-totals')).toContainText(money(businessTotals(complete).NGN, 'NGN', true));
  await expect(page.getByText('Email delivery is not connected.', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Send monthly summary' })).toBeDisabled();
  expect(await page.locator('a[href^="mailto:"]').count()).toBe(0);
  await screenshot(page, 'insights', info.project.name);
  await vault.getByLabel('Receipt month').fill('2001-01'); await expect(vault).toContainText('No approved business expenses'); await expect(vault.locator('.fe2-business-totals')).toContainText('₦0.00');
});

test('Auto-FX confirms server state and persists in another browser context', async ({ page, browser }, info) => {
  const before = !!(await state(page)).user.auto_fx_enabled;
  await page.goto('/fe2-verification'); await feature(page, 'Settings');
  const toggle = page.getByRole('switch', { name: 'Automatic NGN to USD conversion' });
  let release!: () => void; const gate = new Promise<void>(done => { release = done; });
  await page.route('**/api/settings', async route => { const response = await route.fetch(); await gate; await route.fulfill({ response }); });
  await toggle.click(); await expect(toggle).toBeDisabled(); await expect(toggle).toHaveAttribute('aria-checked', String(before)); release();
  await expect(toggle).toHaveAttribute('aria-checked', String(!before)); await expect(page.getByRole('status')).toContainText('saved on the server');
  await page.unroute('**/api/settings'); await page.reload(); await feature(page, 'Settings'); await expect(toggle).toHaveAttribute('aria-checked', String(!before));
  const second = await browser.newContext({ baseURL: process.env.TEST_ORIGIN, viewport: info.project.use.viewport });
  try { await second.request.post('/api/session'); const other = await second.newPage(); await other.goto('/fe2-verification'); await feature(other, 'Settings'); await expect(other.getByRole('switch', { name: 'Automatic NGN to USD conversion' })).toHaveAttribute('aria-checked', String(!before)); } finally { await second.close(); }
  await expect(page.getByText('Account management is awaiting integration.')).toBeVisible();
  await screenshot(page, 'settings', info.project.name);
});

test('support shows honest help articles with messaging disabled and no fake replies', async ({ page }, info) => {
  const transports: string[] = [];
  page.on('request', request => { if (/\/api\/support/.test(request.url())) transports.push(request.url()); });
  await page.goto('/support');
  await expect(page.getByText('Live support unavailable', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'A blocked payment', exact: true }).click();
  const article = page.getByRole('article', { name: 'Help article' }); await expect(article).toContainText('server’s exact decision reason');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled(); await expect(page.getByLabel('Your message')).toBeDisabled();
  await expect(page.getByRole('log')).toHaveCount(0); expect(transports).toEqual([]);
  await page.reload(); await expect(page.getByText('Messages cannot be sent or stored in this build.', { exact: false })).toBeVisible();
  await screenshot(page, 'support', info.project.name);
});

test('notifications poll server read state and review opens the subscription without replaying payment', async ({ page }, info) => {
  const outcome = await (await page.request.post('/api/demo', { data: { scenario: 'hike' } })).json();
  const before = await state(page); const transactionIds = before.transactions.map(item => item.id);
  await page.goto('/fe2-verification'); await feature(page, 'Notifications');
  const center = page.getByRole('region', { name: 'Notification centre' });
  await expect(center).toContainText('1 unread in the latest 30');
  let financialMutations = 0; page.on('request', request => { if (request.method() === 'PATCH' || request.url().includes('/api/demo')) financialMutations++; });
  await center.getByRole('button', { name: `Review ${outcome.merchant_name}`, exact: true }).click();
  await expect(page.getByRole('status')).toContainText(`Review requested for ${outcome.merchant_name}`);
  expect(financialMutations).toBe(0); expect((await state(page)).transactions.map(item => item.id)).toEqual(transactionIds);
  await page.request.post('/api/demo', { data: { scenario: 'hike' } });
  await expect(center.locator('.fe2-notification')).toHaveCount(2, { timeout: 10_000 });
  const transaction = (await state(page)).transactions.find(item => item.id === outcome.transaction_id)!;
  const reviewed = await page.request.patch(`/api/subscriptions/${transaction.subscription_id}`, { data: { expected_max_amount: outcome.amount } }); expect(reviewed.ok()).toBe(true);
  await expect(center).toContainText('0 unread in the latest 30', { timeout: 10_000 });
  await page.reload(); await feature(page, 'Notifications'); await expect(center.locator('.fe2-notification[data-read="true"]')).toHaveCount(2);
  await expect(center.getByRole('button', { name: /mark.*read/i })).toHaveCount(0);
  expect((await state(page)).user.ngn_balance).toBe(before.user.ngn_balance);
  await screenshot(page, 'notifications', info.project.name);
});

test('production landing CTAs use the product route and product claims describe the delivered demo', async ({ page }, info) => {
  await page.goto('/');
  const links = page.locator('[data-product-cta]'); expect(await links.count()).toBeGreaterThan(0);
  for (const href of await links.evaluateAll(elements => elements.map(element => element.getAttribute('href')))) { expect(href).toBe('/shield'); expect(href).not.toMatch(/localhost|127\.0\.0\.1/); }
  await expect(page.getByText(/Issuance, funding, FX and settlement are simulated/)).toBeVisible();
  await screenshot(page, 'landing', info.project.name);
  await page.getByRole('link', { name: 'Launch the demo', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Stay in control.' })).toBeVisible();
  await page.goto(process.env.FE2_LANDING_ORIGIN!);
  await expect(page).toHaveTitle('RETREST — Recurring payment control demo');
  for (const href of await page.locator('[data-product-cta]').evaluateAll(elements => elements.map(element => element.getAttribute('href')))) expect(href).toBe('/shield');
  await expect(page.getByText(/Card issuance, funding, FX and settlement are simulated/)).toBeVisible();
  await screenshot(page, 'starter-landing', info.project.name);
});
