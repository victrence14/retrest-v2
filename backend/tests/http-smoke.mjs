import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const origin = process.env.TEST_ORIGIN ?? "http://localhost:3000";
const health = await (await fetch(`${origin}/api/health`)).json();
assert.equal(health.test_instance, true, "HTTP smoke tests require NODE_ENV=test and DATABASE_PATH=:memory:. Refusing to mutate a persistent demo.");
const envPath = new URL("../.env", import.meta.url);
const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const webhookSecret = process.env.CARD_WEBHOOK_SECRET ?? env.match(/^CARD_WEBHOOK_SECRET=(.+)$/m)?.[1];
assert.ok(webhookSecret, "Configure CARD_WEBHOOK_SECRET before testing");
const session = await fetch(`${origin}/api/session`, { method: "POST", headers: { Origin: origin } });
assert.equal(session.status, 200);
const cookie = session.headers.get("set-cookie").split(";")[0];
const state = async () => (await fetch(`${origin}/api/state`, { headers: { Cookie: cookie } })).json();
const initial = await state();
assert.equal(initial.subscriptions.length >= 6, true);
assert.equal((await fetch(`${origin}/api/state`)).status, 401);
assert.equal((await fetch(`${origin}/api/settings`, { method: "PATCH", headers: { Cookie: cookie, Origin: "https://untrusted.example", "Content-Type": "application/json" }, body: JSON.stringify({auto_fx_enabled:false}) })).status, 403);
assert.equal((await fetch(`${origin}/api/webhooks/card-auth`, { method: "POST", body: "{}" })).status, 401);

async function webhook(payload, timestamp = String(Math.floor(Date.now()/1000))) {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256",webhookSecret).update(`${timestamp}.${body}`).digest("hex");
  return fetch(`${origin}/api/webhooks/card-auth`, { method: "POST", headers: {"Content-Type":"application/json","x-retrest-timestamp":timestamp,"x-retrest-signature":signature}, body });
}
const request = {authorization_id:`smoke_${randomUUID()}`,provider_card_id:"retrest_demo_master",merchant_descriptor:"SPOTIFY",amount:130000,currency:"NGN"};
const approved = await webhook(request); assert.equal(approved.status,200);
const decision = await approved.json();
const settled = await state();
const replay = await webhook(request);assert.equal(replay.headers.get("x-idempotent-replay"),"true");assert.deepEqual(await replay.json(),decision);
assert.deepEqual((await state()).user,settled.user);
assert.equal((await webhook({...request,authorization_id:randomUUID(),amount:-1})).status,400);
assert.equal((await webhook({...request,authorization_id:randomUUID()},String(Math.floor(Date.now()/1000)-600))).status,401);
for(const [scenario,expected] of [["paused","DECLINE"],["hike","DECLINE"],["fx","APPROVE"],["pool","APPROVE"]]) {
  const before=await state();
  const response=await fetch(`${origin}/api/demo`,{method:"POST",headers:{Cookie:cookie,Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({scenario})});
  assert.equal(response.status,200);const result=await response.json();assert.equal(result.decision,expected,scenario);
  if(expected==="DECLINE")assert.deepEqual(result.state.user,before.user);
  console.log(`${scenario}: ${result.decision} (${result.duration_ms} ms)`);
}
const receipt = await fetch(`${origin}${decision.receipt_url}`,{headers:{Cookie:cookie}});assert.equal(receipt.status,200);assert.match(await receipt.text(),/Payment, protected/);
const receiptPdf=await fetch(`${origin}${decision.receipt_url}?format=pdf`,{headers:{Cookie:cookie}});assert.equal(receiptPdf.headers.get("content-type"),"application/pdf");assert.ok(Buffer.from(await receiptPdf.arrayBuffer()).toString().startsWith("%PDF-1.4"));
for(const format of ["csv","pdf"]) {
  const response=await fetch(`${origin}/api/export?format=${format}`,{headers:{Cookie:cookie}});assert.equal(response.status,200);assert.match(response.headers.get("content-disposition"),new RegExp(`\\.${format}`));
}
console.log(`Signed webhook: ${approved.headers.get("server-timing")}; replay, signature rejection, CSRF, demo scenarios, and receipt exports passed.`);
