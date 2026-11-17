import { randomUUID } from "node:crypto";
import { dashboard, getDb } from "@/lib/db";
import { requireUser, jsonBody } from "@/lib/api";

export async function POST(request: Request) {
  const auth = await requireUser(request, true);
  if (auth.error) return auth.error;
  const body = await jsonBody(request);
  if (!body || typeof body.merchant_name !== "string" || !body.merchant_name.trim() || body.merchant_name.length > 60 || typeof body.merchant_descriptor !== "string" || !/^[A-Z0-9 _.-]{2,60}$/.test(body.merchant_descriptor) || !Number.isSafeInteger(body.expected_amount) || Number(body.expected_amount) <= 0 || Number(body.expected_amount) > 100000000 || (body.currency !== "NGN" && body.currency !== "USD") || typeof body.next_billing_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.next_billing_date) || Number.isNaN(new Date(body.next_billing_date).getTime())) return Response.json({ error: "Enter a merchant, amount, currency, and renewal date" }, { status: 400 });
  const db = getDb();
  if (db.prepare("SELECT id FROM merchant_subscriptions WHERE user_id=? AND merchant_descriptor=?").get(auth.userId, body.merchant_descriptor.trim())) return Response.json({ error: "This merchant is already connected" }, { status: 409 });
  const id = randomUUID();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO merchant_subscriptions (id,user_id,merchant_name,merchant_descriptor,category,status,expected_amount,expected_max_amount,currency,next_billing_date,plan_name,is_business_expense) VALUES (?,?,?,?,?,'ACTIVE',?,?,?,?,?,?)")
      .run(id, auth.userId, body.merchant_name.trim(), body.merchant_descriptor.trim(), "Other", Number(body.expected_amount), Number(body.expected_amount), body.currency, new Date(body.next_billing_date).toISOString(), "Monthly subscription", Number(body.is_business_expense === true));
    db.prepare("INSERT INTO merchant_rules (id,subscription_id,user_id,merchant_descriptor,status,expected_max_amount) VALUES (?,?,?,?,'ACTIVE',?)").run(randomUUID(), id, auth.userId, body.merchant_descriptor.trim(), Number(body.expected_amount));
    db.exec("COMMIT");
  } catch { db.exec("ROLLBACK"); return Response.json({ error: "Could not connect merchant" }, { status: 500 }); }
  return Response.json(dashboard(auth.userId));
}
