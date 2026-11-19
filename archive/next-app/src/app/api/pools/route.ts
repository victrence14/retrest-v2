import { randomUUID } from "node:crypto";
import { dashboard, getDb } from "@/lib/db";
import { requireUser, jsonBody } from "@/lib/api";

export async function POST(request: Request) {
  const auth = await requireUser(request, true);
  if (auth.error) return auth.error;
  const body = await jsonBody(request);
  if (!body || typeof body.subscription_id !== "string" || typeof body.name !== "string" || !body.name.trim() || body.name.length > 60 || !Array.isArray(body.members) || body.members.length < 2 || body.members.length > 10) return Response.json({ error: "Choose a subscription, pool name, and 2–10 members" }, { status: 400 });
  const db = getDb();
  const sub = db.prepare("SELECT * FROM merchant_subscriptions WHERE id=? AND user_id=?").get(body.subscription_id, auth.userId);
  if (!sub) return Response.json({ error: "Subscription not found" }, { status: 404 });
  if (db.prepare("SELECT id FROM split_pools WHERE subscription_id=?").get(body.subscription_id)) return Response.json({ error: "This subscription already has a pool" }, { status: 409 });
  let total = 0;
  const emails = new Set<string>();
  for (const m of body.members) {
    if (!m || typeof m !== "object" || typeof m.name !== "string" || !m.name.trim() || m.name.length > 60 || typeof m.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email) || !Number.isSafeInteger(m.share_amount) || m.share_amount <= 0 || emails.has(m.email.toLowerCase())) return Response.json({ error: "Each member needs a unique email, name, and positive share" }, { status: 400 });
    emails.add(m.email.toLowerCase()); total += m.share_amount;
  }
  if (total !== Number(sub.expected_amount)) return Response.json({ error: "Member shares must equal the subscription total" }, { status: 400 });
  const user = db.prepare("SELECT email FROM users WHERE id=?").get(auth.userId)!;
  if (!emails.has(String(user.email).toLowerCase())) return Response.json({ error: "Include yourself as the pool host" }, { status: 400 });
  const id = randomUUID();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO split_pools (id,subscription_id,host_user_id,name,target_amount,currency,invite_token,fallback_enabled) VALUES (?,?,?,?,?,?,?,?)").run(id, body.subscription_id, auth.userId, body.name.trim(), Number(sub.expected_amount), String(sub.currency), randomUUID(), body.fallback_enabled === false ? 0 : 1);
    for (const member of body.members) db.prepare("INSERT INTO pool_members (id,pool_id,user_id,name,email,share_amount,payment_status) VALUES (?,?,?,?,?,?,?)").run(randomUUID(), id, member.email.toLowerCase() === String(user.email).toLowerCase() ? auth.userId : null, member.name.trim(), member.email.toLowerCase(), member.share_amount, "PENDING");
    db.exec("COMMIT");
  } catch { db.exec("ROLLBACK"); return Response.json({ error: "Could not create pool" }, { status: 500 }); }
  return Response.json({ state: dashboard(auth.userId), invite_token: db.prepare("SELECT invite_token FROM split_pools WHERE id=?").get(id)!.invite_token });
}
