import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { authorize, validateAuthorization } from "../src/lib/authorization.ts";
import { initializeDatabase, seedDatabase, EXCHANGE_RATE } from "../src/lib/db.ts";
import { makePdf } from "../src/lib/documents.ts";
import type { AuthorizationPayload } from "../src/lib/types.ts";

function setup() {
  const db = initializeDatabase(new DatabaseSync(":memory:"));
  seedDatabase(db);
  return db;
}
const request = (overrides: Partial<AuthorizationPayload> = {}): AuthorizationPayload => ({ authorization_id: "test_auth", provider_card_id: "retrest_demo_master", merchant_descriptor: "SPOTIFY", amount: 130000, currency: "NGN", ...overrides });
const balance = (db: DatabaseSync) => db.prepare("SELECT ngn_balance,usd_balance,fx_converted_ngn FROM users WHERE id='user_ada'").get()!;

test("normal authorization settles once, creates a receipt, and advances renewal by 30 days", () => {
  const db = setup();
  const before = balance(db);
  const date = String(db.prepare("SELECT next_billing_date FROM merchant_subscriptions WHERE id='spotify'").get()!.next_billing_date);
  const result = authorize(db, request());
  assert.equal(result.status, 200); assert.equal(result.body.decision, "APPROVE");
  assert.equal(balance(db).ngn_balance, Number(before.ngn_balance)-130000);
  assert.match(result.body.receipt_url!, /^\/api\/receipts\//);
  const next = String(db.prepare("SELECT next_billing_date FROM merchant_subscriptions WHERE id='spotify'").get()!.next_billing_date);
  assert.equal(new Date(next).getTime()-new Date(date).getTime(),30*86400000);
  db.close();
});

test("kill switch takes precedence over price and insufficient balances", () => {
  const db=setup(); const before=balance(db);
  const result=authorize(db,request({merchant_descriptor:"YOUTUBE",amount:999999999}));
  assert.equal(result.status,403);assert.equal(result.body.reason,"Blocked by Kill Switch");
  assert.deepEqual(balance(db),before);db.close();
});

test("20% price increase is blocked, preserves funds and date, and creates an approval notification", () => {
  const db=setup();const before=balance(db);
  const result=authorize(db,request({amount:156000}));
  assert.equal(result.status,403);assert.equal(result.body.reason,"Price Hike Blocked");
  assert.deepEqual(balance(db),before);assert.equal(result.body.receipt_url,null);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM notifications").get()!.n,1);db.close();
});

test("JIT FX converts exactly the missing USD cents",()=>{
  const db=setup();const before=balance(db);
  const result=authorize(db,request({merchant_descriptor:"OPENAI",amount:2000,currency:"USD"}));
  const exact=Math.ceil(750*EXCHANGE_RATE);
  assert.equal(result.status,200);assert.equal(result.body.fx_ngn_amount,exact);
  assert.equal(balance(db).ngn_balance,Number(before.ngn_balance)-exact);
  assert.equal(balance(db).usd_balance,0);assert.equal(balance(db).fx_converted_ngn,exact);db.close();
});

test("disabled auto-FX declines and never changes NGN",()=>{
  const db=setup();db.prepare("UPDATE users SET auto_fx_enabled=0 WHERE id='user_ada'").run();const before=balance(db);
  const result=authorize(db,request({merchant_descriptor:"OPENAI",amount:2000,currency:"USD"}));
  assert.equal(result.status,403);assert.deepEqual(balance(db),before);db.close();
});

test("insufficient NGN for FX leaves both wallets unchanged",()=>{
  const db=setup();db.prepare("UPDATE users SET ngn_balance=10 WHERE id='user_ada'").run();const before=balance(db);
  const result=authorize(db,request({merchant_descriptor:"OPENAI",amount:2000,currency:"USD"}));
  assert.equal(result.status,403);assert.deepEqual(balance(db),before);db.close();
});

test("pool uses its balance first and host pays only the shortfall",()=>{
  const db=setup();const before=balance(db);
  const result=authorize(db,request({merchant_descriptor:"NETFLIX",amount:700000}));
  assert.equal(result.status,200);assert.equal(result.body.pool_amount,500000);
  assert.equal(balance(db).ngn_balance,Number(before.ngn_balance)-200000);
  assert.equal(db.prepare("SELECT pool_balance FROM split_pools WHERE id='pool_netflix'").get()!.pool_balance,0);db.close();
});

test("underfunded pool with fallback disabled declines atomically",()=>{
  const db=setup();db.prepare("UPDATE split_pools SET fallback_enabled=0 WHERE id='pool_netflix'").run();const before=balance(db);
  const result=authorize(db,request({merchant_descriptor:"NETFLIX",amount:700000}));
  assert.equal(result.status,403);assert.deepEqual(balance(db),before);
  assert.equal(db.prepare("SELECT pool_balance FROM split_pools WHERE id='pool_netflix'").get()!.pool_balance,500000);db.close();
});

test("fully funded USD pool approves without unnecessary FX or host funds",()=>{
  const db=setup();
  db.prepare("UPDATE users SET ngn_balance=0,usd_balance=0,auto_fx_enabled=0 WHERE id='user_ada'").run();
  db.prepare("INSERT INTO split_pools (id,subscription_id,host_user_id,name,pool_balance,target_amount,currency,invite_token) VALUES ('usd_pool','chatgpt','user_ada','USD pool',2000,2000,'USD','usd_invite')").run();
  const result=authorize(db,request({merchant_descriptor:"OPENAI",amount:2000,currency:"USD"}));
  assert.equal(result.status,200);assert.equal(result.body.fx_ngn_amount,0);assert.equal(result.body.pool_amount,2000);db.close();
});

test("USD pool fallback disabled rolls back a prospective FX conversion",()=>{
  const db=setup();
  db.prepare("INSERT INTO split_pools (id,subscription_id,host_user_id,name,pool_balance,target_amount,currency,fallback_enabled,invite_token) VALUES ('usd_pool','chatgpt','user_ada','USD pool',100,2000,'USD',0,'usd_invite')").run();
  const before=balance(db);const result=authorize(db,request({merchant_descriptor:"OPENAI",amount:2000,currency:"USD"}));
  assert.equal(result.status,403);assert.deepEqual(balance(db),before);assert.equal(result.body.fx_ngn_amount,0);db.close();
});

test("duplicate approved authorization replays the same response without another debit",()=>{
  const db=setup();const first=authorize(db,request());const settled=balance(db);
  const second=authorize(db,request());assert.deepEqual(second.body,first.body);assert.equal(second.replayed,true);
  assert.deepEqual(balance(db),settled);assert.equal(db.prepare("SELECT COUNT(*) n FROM transaction_logs WHERE authorization_id='test_auth'").get()!.n,1);db.close();
});

test("duplicate decline cannot become approved when a merchant rule changes",()=>{
  const db=setup();const first=authorize(db,request({amount:156000}));
  db.prepare("UPDATE merchant_rules SET expected_max_amount=160000 WHERE subscription_id='spotify'").run();
  const second=authorize(db,request({amount:156000}));assert.equal(second.status,403);assert.deepEqual(second.body,first.body);db.close();
});

test("a paused merchant remains blocked after approved price-limit changes",()=>{
  const db=setup();db.prepare("UPDATE merchant_rules SET expected_max_amount=999999 WHERE subscription_id='youtube'").run();
  const result=authorize(db,request({merchant_descriptor:"YOUTUBE",amount:190000}));assert.equal(result.body.reason,"Blocked by Kill Switch");db.close();
});

test("unknown merchants, frozen cards, and currency mismatches are declined without wallet mutations",()=>{
  for(const scenario of ["unknown","frozen","currency"]){const db=setup();const before=balance(db);
    if(scenario==="frozen")db.prepare("UPDATE virtual_cards SET card_status='FROZEN'").run();
    const result=authorize(db,request({merchant_descriptor:scenario==="unknown"?"UNAPPROVED":"SPOTIFY",currency:scenario==="currency"?"USD":"NGN"}));
    assert.equal(result.status,403);assert.deepEqual(balance(db),before);db.close();}
});

test("rejects invalid, negative, fractional, and unsafe authorization amounts",()=>{
  for(const amount of [0,-1,1.5,Number.MAX_SAFE_INTEGER,Infinity,NaN,"1300"]){assert.equal(validateAuthorization({...request(),amount}),false);}
  assert.equal(validateAuthorization(request()),true);assert.equal(validateAuthorization({...request(),currency:"EUR"}),false);
  assert.equal(validateAuthorization(null),false);
});

test("indexed authorization engine completes under the 500ms demo budget",()=>{
  const db=setup();const start=performance.now();authorize(db,request());assert.ok(performance.now()-start<500);db.close();
});

test("receipt pack PDF has a valid catalog, pages, cross-reference table, and EOF",()=>{
  const pdf=makePdf(Array.from({length:90},(_,i)=>`Receipt ${i} (Business) / NGN 4500.00`));
  const text=pdf.toString();assert.ok(text.startsWith("%PDF-1.4"));assert.ok(text.endsWith("%%EOF"));
  assert.match(text,/\/Count 3/);assert.match(text,/xref\n0 /);assert.match(text,/\\\(Business\\\)/);
});
