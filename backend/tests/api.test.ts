import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { CreatePoolResult, Dashboard, DemoResult, InviteSummary } from "@retrest/shared";
import { createApp } from "../src/app.ts";
import type { Config } from "../src/config.ts";
import { openDatabase } from "../src/db/database.ts";

const FRONTEND = "http://localhost:3000";
const config: Config = {
  nodeEnv: "test",
  port: 0,
  corsOrigins: [FRONTEND],
  databasePath: ":memory:",
  demoEnabled: true,
  sessionSecret: "test-session-secret",
  webhookSecret: "test-webhook-secret",
  supabase: null,
};

/** Starts the API on a fresh in-memory database with a demo session cookie. */
async function withApi(run: (api: (path: string, init?: RequestInit) => Promise<Response>, url: string) => Promise<void>) {
  const server = createApp(config, { db: openDatabase(":memory:"), supabase: null }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const session = await fetch(`${url}/api/session`, { method: "POST", headers: { Origin: FRONTEND } });
    assert.equal(session.status, 200);
    const cookie = session.headers.get("set-cookie")!.split(";")[0]!;
    const api = (path: string, init: RequestInit = {}) =>
      fetch(`${url}${path}`, {
        ...init,
        headers: { Cookie: cookie, Origin: FRONTEND, "Content-Type": "application/json", ...init.headers },
      });
    await run(api, url);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const json = async <T>(response: Response) => (await response.json()) as T;

test("session cookie gates the workspace; bootstrap serves the public demo before a session", async () => {
  await withApi(async (api, url) => {
    assert.equal((await fetch(`${url}/api/state`)).status, 401);
    const bootstrap = await json<Dashboard>(await fetch(`${url}/api/bootstrap`));
    assert.equal(bootstrap.user.id, "user_ada");
    const state = await json<Dashboard>(await api("/api/state"));
    assert.ok(state.subscriptions.length >= 6);
    assert.equal(state.demo_enabled, true);
  });
});

test("cookie mutations reject untrusted origins and cross-site requests", async () => {
  await withApi(async (api) => {
    const body = JSON.stringify({ auto_fx_enabled: false });
    assert.equal((await api("/api/settings", { method: "PATCH", body, headers: { Origin: "https://untrusted.example" } })).status, 403);
    assert.equal((await api("/api/settings", { method: "PATCH", body, headers: { "Sec-Fetch-Site": "cross-site" } })).status, 403);
    const saved = await json<Dashboard>(await api("/api/settings", { method: "PATCH", body }));
    assert.equal(saved.user.auto_fx_enabled, 0);
  });
});

test("malformed or invalid bodies return each route's own validation message", async () => {
  await withApi(async (api) => {
    const broken = await api("/api/wallet", { method: "POST", body: "{broken" });
    assert.equal(broken.status, 400);
    assert.deepEqual(await broken.json(), { error: "Enter a valid amount" });
    assert.equal((await api("/api/demo", { method: "POST", body: JSON.stringify({ scenario: "nope" }) })).status, 400);
  });
});

test("kill switch and price limit update the merchant rule", async () => {
  await withApi(async (api) => {
    const paused = await json<Dashboard>(await api("/api/subscriptions/spotify", { method: "PATCH", body: JSON.stringify({ status: "PAUSED" }) }));
    assert.equal(paused.subscriptions.find((s) => s.id === "spotify")?.status, "PAUSED");
    const tooLow = await api("/api/subscriptions/spotify", { method: "PATCH", body: JSON.stringify({ expected_max_amount: 1 }) });
    assert.equal(tooLow.status, 400);
    assert.equal((await api("/api/subscriptions/unknown", { method: "PATCH", body: JSON.stringify({ status: "ACTIVE" }) })).status, 404);
  });
});

test("wallet funding and a new subscription persist", async () => {
  await withApi(async (api) => {
    const before = await json<Dashboard>(await api("/api/state"));
    const funded = await json<Dashboard>(await api("/api/wallet", { method: "POST", body: JSON.stringify({ currency: "USD", amount: 500 }) }));
    assert.equal(funded.user.usd_balance, before.user.usd_balance + 500);
    const body = JSON.stringify({ merchant_name: "Apple Music", merchant_descriptor: "APPLE MUSIC", expected_amount: 150000, currency: "NGN", next_billing_date: "2030-01-01", is_business_expense: true });
    const added = await json<Dashboard>(await api("/api/subscriptions", { method: "POST", body }));
    assert.ok(added.subscriptions.some((s) => s.merchant_descriptor === "APPLE MUSIC"));
    assert.equal((await api("/api/subscriptions", { method: "POST", body })).status, 409);
  });
});

test("simulator scenarios run through the authorization engine", async () => {
  await withApi(async (api) => {
    const normal = await json<DemoResult>(await api("/api/demo", { method: "POST", body: JSON.stringify({ scenario: "normal" }) }));
    assert.equal(normal.decision, "APPROVE");
    assert.ok(normal.state.transactions.some((t) => t.id === normal.transaction_id));
    const hike = await json<DemoResult>(await api("/api/demo", { method: "POST", body: JSON.stringify({ scenario: "hike" }) }));
    assert.equal(hike.decision, "DECLINE");
    assert.equal(hike.reason, "Price Hike Blocked");
    const receipt = await api(`/api/receipts/${normal.transaction_id}`);
    assert.equal(receipt.status, 200);
    assert.match(receipt.headers.get("content-type") ?? "", /text\/html/);
    const pdf = await api(`/api/receipts/${normal.transaction_id}?format=pdf`);
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    const reset = await json<Dashboard>(await api("/api/demo/reset", { method: "POST", body: "{}" }));
    assert.ok(!reset.transactions.some((t) => t.id === normal.transaction_id));
  });
});

test("pools require exact shares, then invites accept contributions publicly", async () => {
  await withApi(async (api, url) => {
    const members = [
      { name: "Ada Okafor", email: "ada@retrest.app", share_amount: 65000 },
      { name: "Friend", email: "friend@example.com", share_amount: 65000 },
    ];
    const wrong = await api("/api/pools", { method: "POST", body: JSON.stringify({ subscription_id: "spotify", name: "Music", members: [members[0], { ...members[1], share_amount: 1 }] }) });
    assert.equal(wrong.status, 400);
    const created = await json<CreatePoolResult>(await api("/api/pools", { method: "POST", body: JSON.stringify({ subscription_id: "spotify", name: "Music", members }) }));
    assert.ok(created.invite_token);

    const invite = await json<InviteSummary>(await fetch(`${url}/api/invites/${created.invite_token}`));
    assert.equal(invite.merchant_name, "Spotify");
    assert.equal(invite.host_name, "Ada Okafor");
    const contribute = (email: string) =>
      fetch(`${url}/api/invites/${created.invite_token}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: FRONTEND }, body: JSON.stringify({ email }) });
    assert.equal((await contribute("stranger@example.com")).status, 404);
    assert.match(((await (await contribute("friend@example.com")).json()) as { message: string }).message, /contribution is in/);
    assert.match(((await (await contribute("friend@example.com")).json()) as { message: string }).message, /all paid up/);
    assert.equal((await fetch(`${url}/api/invites/missing`)).status, 404);
  });
});

test("business export returns CSV and PDF for a valid month only", async () => {
  await withApi(async (api) => {
    const month = new Date().toISOString().slice(0, 7);
    const csv = await api(`/api/export?month=${month}&format=csv`);
    assert.match(csv.headers.get("content-type") ?? "", /^text\/csv/);
    assert.match(await csv.text(), /^"Receipt ID","Date"/);
    assert.equal((await api(`/api/export?month=${month}&format=pdf`)).headers.get("content-type"), "application/pdf");
    assert.equal((await api("/api/export?month=2026-13")).status, 400);
  });
});

test("card webhook verifies the HMAC signature before authorizing", async () => {
  await withApi(async (_api, url) => {
    const body = JSON.stringify({ authorization_id: "hook_1", provider_card_id: "retrest_demo_master", merchant_descriptor: "SPOTIFY", amount: 130000, currency: "NGN" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", config.webhookSecret!).update(`${timestamp}.${body}`).digest("hex");
    const send = (sig: string) =>
      fetch(`${url}/api/webhooks/card-auth`, { method: "POST", headers: { "Content-Type": "application/json", "x-retrest-timestamp": timestamp, "x-retrest-signature": sig }, body });
    assert.equal((await send("0".repeat(64))).status, 401);
    const approved = await send(signature);
    assert.equal(approved.status, 200);
    assert.equal(((await approved.json()) as { decision: string }).decision, "APPROVE");
    const replay = await send(signature);
    assert.equal(replay.headers.get("x-idempotent-replay"), "true");
  });
});
