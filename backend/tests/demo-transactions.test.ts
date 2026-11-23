import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, transaction } from "../src/db/database.ts";
import { demoPeriodSummary, demoTransactionsPage } from "../src/services/demo-transactions.ts";
import { businessExportCsv } from "../src/services/documents.ts";

test("complete demo history reconciles pagination, period totals and CSV beyond 1,000 payments", () => {
  const db = openDatabase(":memory:");
  try {
    db.exec("DELETE FROM notifications; DELETE FROM transaction_logs;");
    const insert = db.prepare(`INSERT INTO transaction_logs
      (id,authorization_id,user_id,subscription_id,merchant_name,amount,currency,status,fx_ngn_amount,http_status,response_json,created_at)
      VALUES (?,?,'user_ada',?,'Demo expense',?,'NGN',?,?,200,'{}',?)`);
    transaction(db, () => {
      for (let i = 0; i < 1205; i++) insert.run("bulk_" + i, "bulk_auth_" + i, "canva", 12345, "APPROVED", 11, "2026-11-10T00:00:00.000Z");
      insert.run("declined", "declined_auth", "canva", 100, "DECLINED_PRICE_HIKE", 0, "2026-11-10T00:00:00.000Z");
      insert.run("personal", "personal_auth", "spotify", 200, "APPROVED", 0, "2026-11-10T00:00:00.000Z");
      insert.run("boundary", "boundary_auth", "canva", 300, "APPROVED", 0, "2026-12-01T00:00:00.000Z");
    });
    const filters = { from: "2026-11-01T00:00:00.000Z", to: "2026-12-01T00:00:00.000Z", business: true, limit: 100 };
    const seen = [];
    let cursor: string | undefined;
    do {
      const result = demoTransactionsPage(db, "user_ada", { ...filters, cursor });
      seen.push(...result.data);
      cursor = result.next_cursor ?? undefined;
    } while (cursor);
    assert.equal(seen.length, 1206);
    assert.equal(new Set(seen.map(row => row.id)).size, 1206);
    assert.deepEqual(demoPeriodSummary(db, "user_ada", filters), [{
      currency: "NGN", approved_count: 1205, declined_count: 1,
      approved_amount_minor: String(1205 * 12345), fx_ngn_amount_minor: String(1205 * 11),
    }]);
    assert.equal(businessExportCsv(seen.filter(row => row.status === "APPROVED")).trimEnd().split("\r\n").length, 1206);
    const first = demoTransactionsPage(db, "user_ada", filters);
    assert.throws(() => demoTransactionsPage(db, "user_ada", { ...filters, business: false, cursor: first.next_cursor! }));
  } finally { db.close(); }
});

test("SQLite restarts preserve demo settings, merchant rules, pool invitations and transaction history without reseeding", () => {
  const directory = mkdtempSync(join(tmpdir(), "retrest-persistence-"));
  const path = join(directory, "demo.sqlite");
  let db: ReturnType<typeof openDatabase> | undefined;
  try {
    db = openDatabase(path);
    const invite = db.prepare("SELECT invite_token FROM split_pools WHERE id='pool_netflix'").get()!.invite_token;
    const count = db.prepare("SELECT count(*) AS count FROM merchant_subscriptions").get()!.count;
    db.exec(`UPDATE users SET auto_fx_enabled=0,ngn_balance=12345 WHERE id='user_ada';
      UPDATE merchant_subscriptions SET status='PAUSED' WHERE id='spotify';
      UPDATE merchant_rules SET status='PAUSED' WHERE subscription_id='spotify';
      INSERT INTO transaction_logs(id,authorization_id,user_id,subscription_id,merchant_name,amount,currency,status,http_status,response_json)
      VALUES('restart_payment','restart_auth','user_ada','canva','Persisted payment',101,'NGN','APPROVED',200,'{}');`);
    db.close();
    db = undefined;
    db = openDatabase(path);
    assert.deepEqual({ ...db.prepare("SELECT auto_fx_enabled,ngn_balance FROM users WHERE id='user_ada'").get() }, { auto_fx_enabled: 0, ngn_balance: 12345 });
    assert.equal(db.prepare("SELECT status FROM merchant_rules WHERE subscription_id='spotify'").get()!.status, "PAUSED");
    assert.equal(db.prepare("SELECT status FROM merchant_subscriptions WHERE id='spotify'").get()!.status, "PAUSED");
    assert.equal(db.prepare("SELECT count(*) AS count FROM merchant_subscriptions").get()!.count, count);
    assert.equal(db.prepare("SELECT invite_token FROM split_pools WHERE id='pool_netflix'").get()!.invite_token, invite);
    assert.equal(db.prepare("SELECT amount FROM transaction_logs WHERE id='restart_payment'").get()!.amount, 101);
  } finally { db?.close(); rmSync(directory, { recursive: true, force: true }); }
});
