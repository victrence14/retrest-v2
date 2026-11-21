import { test } from "node:test";
import assert from "node:assert/strict";
import {
  equalShares,
  validatePool,
  type MemberDraft,
} from "@/features/pools/shares";
import {
  majorAmount,
  parseMinorAmount,
  sumMinorAmounts,
} from "@/lib/money";
import {
  businessTotals,
  parseBusinessExport,
} from "@/features/insights/business-export";
import { authenticatedFile } from "@/lib/api/client";
import {
  loadReceipt,
  receiptEligible,
} from "@/features/transactions/api";
import { inviteReturnPath } from "@/features/invites/api";
import { recentUnreadCount } from "@/features/notifications/selectors";
import type { Subscription, User } from "@retrest/shared";

const host: User = {
  id: "host",
  name: "Pool host",
  email: "host@example.com",
  ngn_balance: 100000,
  usd_balance: 0,
  auto_fx_enabled: 1,
  fx_converted_ngn: 0,
};
const subscription: Subscription = {
  id: "plan",
  user_id: host.id,
  merchant_name: "Team plan",
  merchant_descriptor: "TEAM PLAN",
  category: "Other",
  status: "ACTIVE",
  expected_amount: 10001,
  expected_max_amount: 10001,
  currency: "NGN",
  billing_cycle: "MONTHLY",
  next_billing_date: "2026-12-01T00:00:00Z",
  is_business_expense: 1,
  needs_review: 0,
  plan_name: "Team",
};
const members = (): MemberDraft[] => [
  { key: "host", name: host.name, email: host.email, amount: "50.01" },
  {
    key: "guest",
    name: "Invited member",
    email: "guest@example.com",
    amount: "50.00",
  },
];

test("decimal parsing preserves cents exactly and rejects precision loss, signs and unsafe values", () => {
  assert.equal(parseMinorAmount("0.29"), 29);
  assert.equal(parseMinorAmount(" 003.5 "), 350);
  assert.equal(parseMinorAmount("90071992547409.91"), Number.MAX_SAFE_INTEGER);
  assert.equal(majorAmount(Number.MAX_SAFE_INTEGER), "90071992547409.91");
  for (const value of [
    "-1",
    "+1",
    "1e3",
    "1.001",
    "1,000.00",
    "NaN",
    "Infinity",
    "",
    ".50",
    "1.",
    "90071992547409.92",
  ])
    assert.equal(parseMinorAmount(value), null, value);
  assert.equal(sumMinorAmounts([Number.MAX_SAFE_INTEGER, 1]), null);
});

test("equal shares conserve every minor unit in stable order across member counts", () => {
  assert.deepEqual(equalShares(130000, 3), [43334, 43333, 43333]);
  for (const target of [10, 101, 10001, 700000, Number.MAX_SAFE_INTEGER]) {
    for (let count = 2; count <= 10; count++) {
      const values = equalShares(target, count);
      assert.equal(
        values.reduce((total, value) => total + BigInt(value), 0n),
        BigInt(target),
      );
      assert.ok(values.every(Number.isSafeInteger));
      assert.ok(Math.max(...values) - Math.min(...values) <= 1);
      assert.deepEqual(
        values,
        [...values].sort((a, b) => b - a),
      );
    }
  }
  for (const count of [0, 1, 11, 2.5, Infinity])
    assert.throws(() => equalShares(100, count));
  assert.throws(() => equalShares(1, 2));
});

test("pool validation normalizes member identity and requires exact positive custom allocations", () => {
  const draft = members();
  draft[1].email = " GUEST@EXAMPLE.COM ";
  const result = validatePool({
    subscription,
    host,
    members: draft,
    mode: "custom",
    name: " Team pool ",
    fallback: false,
  });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.payload.name, "Team pool");
    assert.equal(result.payload.members[1].email, "guest@example.com");
    assert.equal(result.payload.members[0].share_amount, 5001);
    assert.equal(result.payload.fallback_enabled, false);
  }
  for (const invalid of [
    "-0.01",
    "0",
    "100.02",
    "50.001",
    "49.99",
    "90071992547409.92",
  ]) {
    const changed = members();
    changed[0].amount = invalid;
    assert.equal(
      validatePool({
        subscription,
        host,
        members: changed,
        mode: "custom",
        name: "Team pool",
        fallback: true,
      }).ok,
      false,
      invalid,
    );
  }
});

test("pool validation rejects duplicate identities, missing host and a subscription from another account", () => {
  const duplicate = members();
  duplicate[1].email = " HOST@EXAMPLE.COM ";
  assert.equal(
    validatePool({
      subscription,
      host,
      members: duplicate,
      mode: "equal",
      name: "Pool",
      fallback: true,
    }).ok,
    false,
  );
  const missingHost = members();
  missingHost[0].email = "another@example.com";
  assert.equal(
    validatePool({
      subscription,
      host,
      members: missingHost,
      mode: "equal",
      name: "Pool",
      fallback: true,
    }).ok,
    false,
  );
  assert.equal(
    validatePool({
      subscription: { ...subscription, user_id: "other" },
      host,
      members: members(),
      mode: "equal",
      name: "Pool",
      fallback: true,
    }).ok,
    false,
  );
});

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const header = [
  "Receipt ID",
  "Date",
  "Merchant",
  "Amount",
  "Currency",
  "Status",
  "Receipt URL",
]
  .map(quote)
  .join(",");
const csvRow = (
  id: string,
  merchant = "Business plan",
  amount = "1.01",
  currency = "NGN",
  status = "APPROVED",
) =>
  [
    id,
    "2026-11-20T12:00:00Z",
    merchant,
    amount,
    currency,
    status,
    `/api/receipts/${id}`,
  ]
    .map(quote)
    .join(",");

test("business exports handle quoted commas, newlines and formula-protected names", () => {
  const text = `${header}\r\n${csvRow("receipt", 'Agency, "design"\nsubscription')}\r\n${csvRow("second", "'=SUM(A1:A2)", "20.29", "USD")}\r\n`;
  const rows = parseBusinessExport(text, "2026-11");
  assert.equal(rows[0].merchant, 'Agency, "design"\nsubscription');
  assert.equal(rows[1].merchant, "'=SUM(A1:A2)");
  assert.deepEqual(businessTotals(rows), { NGN: 101, USD: 2029 });
});

test("monthly business totals include the complete export beyond 100 rows without FX mixing", () => {
  const csv = [
    header,
    ...Array.from({ length: 125 }, (_, index) => csvRow(`receipt-${index}`)),
    csvRow("usd-receipt", "Dollar plan", "0.29", "USD"),
  ].join("\r\n");
  const rows = parseBusinessExport(csv, "2026-11");
  assert.equal(rows.length, 126);
  assert.deepEqual(businessTotals(rows), { NGN: 12625, USD: 29 });
});

test("business reports fail closed on changed schemas, duplicate rows, incomplete files and invalid statuses", () => {
  for (const text of [
    header.replace("Amount", "Total"),
    `${header}\n${csvRow("same")}\n${csvRow("same")}`,
    `${header}\n"incomplete`,
    `${header}\n${csvRow("id", "Plan", "1.001")}`,
    `${header}\n${csvRow("id", "Plan", "1", "EUR")}`,
    `${header}\n${csvRow("id", "Plan", "1", "NGN", "DECLINED_PRICE_HIKE")}`,
  ])
    assert.throws(() => parseBusinessExport(text, "2026-11"));
  assert.throws(() =>
    parseBusinessExport(`${header}\n${csvRow("id")}`, "2026-10"),
  );
  assert.throws(() => parseBusinessExport(header, "2026-13"));
});

test("receipts authenticate using the selected cookie contract, ignore arbitrary URLs and reject unsettled records", async () => {
  const original = globalThis.fetch;
  const calls: { path: string; options: RequestInit | undefined }[] = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path: String(path), options });
    return new Response("%PDF-1.4", {
      headers: { "Content-Type": "application/pdf" },
    });
  };
  try {
    for (const status of [
      "DECLINED_PRICE_HIKE",
      "PENDING",
      "AUTHORIZED",
      "REVERSED",
    ]) {
      assert.equal(
        receiptEligible({ status, receipt_url: "/api/receipts/declined" }),
        false,
      );
      await assert.rejects(
        loadReceipt({
          id: "declined",
          status,
          receipt_url: "/api/receipts/declined",
        }),
      );
    }
    assert.equal(calls.length, 0);
    await loadReceipt({
      id: "owned",
      status: "APPROVED",
      receipt_url: "https://untrusted.example/receipt",
    });
    assert.equal(calls[0].path, "/api/receipts/owned?format=pdf");
    assert.equal(calls[0].options?.credentials, "same-origin");
    assert.equal(calls[0].options?.redirect, "error");
    await assert.rejects(
      authenticatedFile("https://untrusted.example/receipt", "application/pdf"),
    );
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("receipt downloads reject login/error documents and surface server denials", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response("<html>login</html>", {
        headers: { "Content-Type": "text/html" },
      });
    await assert.rejects(
      authenticatedFile("/api/receipts/owned", "application/pdf"),
      /requested document/,
    );
    globalThis.fetch = async () =>
      Response.json({ error: "Session required" }, { status: 401 });
    await assert.rejects(
      authenticatedFile("/api/receipts/owned", "application/pdf"),
      /Session required/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("invite login return is local and recent unread count uses server read_at only", () => {
  assert.equal(
    inviteReturnPath("invite-token"),
    "/login?next=%2Finvite%2Finvite-token",
  );
  assert.throws(() => inviteReturnPath("//evil.example"));
  assert.equal(
    recentUnreadCount([
      {
        id: "1",
        title: "Update",
        message: "Review",
        read_at: null,
        subscription_id: "plan",
        transaction_id: null,
      },
      {
        id: "2",
        title: "Read",
        message: "Done",
        read_at: "2026-11-20T12:00:00Z",
        subscription_id: null,
        transaction_id: null,
      },
    ]),
    1,
  );
});

