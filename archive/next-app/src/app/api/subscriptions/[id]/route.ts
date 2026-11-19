import { getDb, dashboard } from "@/lib/db";
import { requireUser, jsonBody } from "@/lib/api";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request, true);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const body = await jsonBody(request);
  if (!body || (body.status !== "ACTIVE" && body.status !== "PAUSED" && body.expected_max_amount === undefined)) return Response.json({ error: "Invalid merchant rule" }, { status: 400 });
  const db = getDb();
  const sub = db.prepare("SELECT * FROM merchant_subscriptions WHERE id=? AND user_id=?").get(id, auth.userId);
  if (!sub) return Response.json({ error: "Subscription not found" }, { status: 404 });
  if (body.expected_max_amount !== undefined && (!Number.isSafeInteger(body.expected_max_amount) || Number(body.expected_max_amount) < Number(sub.expected_amount) || Number(body.expected_max_amount) > 100000000000)) return Response.json({ error: "Maximum must be an integer at least equal to the expected amount" }, { status: 400 });
  db.exec("BEGIN IMMEDIATE");
  try {
    if (body.status === "ACTIVE" || body.status === "PAUSED") {
      db.prepare("UPDATE merchant_subscriptions SET status=?,needs_review=CASE WHEN ?='PAUSED' THEN 0 ELSE needs_review END WHERE id=?").run(body.status, body.status, id);
      db.prepare("UPDATE merchant_rules SET status=? WHERE subscription_id=?").run(body.status, id);
    }
    if (body.expected_max_amount !== undefined) {
      db.prepare("UPDATE merchant_subscriptions SET expected_max_amount=? WHERE id=?").run(Number(body.expected_max_amount), id);
      db.prepare("UPDATE merchant_rules SET expected_max_amount=? WHERE subscription_id=?").run(Number(body.expected_max_amount), id);
      db.prepare("UPDATE notifications SET read_at=? WHERE subscription_id=? AND user_id=?").run(new Date().toISOString(), id, auth.userId);
    }
    db.exec("COMMIT");
  } catch { db.exec("ROLLBACK"); return Response.json({ error: "Could not save merchant rule" }, { status: 500 }); }
  return Response.json(dashboard(auth.userId));
}
