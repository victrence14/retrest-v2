import { randomUUID } from "node:crypto";
import { dashboard, getDb, demoEnabled } from "@/lib/db";
import { requireUser, jsonBody } from "@/lib/api";
import { authorize } from "@/lib/authorization";
import type { Currency } from "@/lib/types";

export async function POST(request: Request) {
  const auth = await requireUser(request, true);
  if (auth.error) return auth.error;
  if (!demoEnabled()) return Response.json({ error: "Demo simulator disabled" }, { status: 403 });
  const body = await jsonBody(request);
  if (!body || !["normal", "paused", "hike", "fx", "pool"].includes(String(body.scenario))) return Response.json({ error: "Unknown scenario" }, { status: 400 });
  const db = getDb();
  const id = body.scenario === "paused" ? "youtube" : body.scenario === "fx" ? "chatgpt" : body.scenario === "pool" ? "netflix" : "spotify";
  const sub = db.prepare("SELECT * FROM merchant_subscriptions WHERE id=? AND user_id=?").get(id, auth.userId);
  const card = db.prepare("SELECT provider_card_id FROM virtual_cards WHERE user_id=?").get(auth.userId);
  if (!sub || !card) return Response.json({ error: "Demo data unavailable" }, { status: 404 });
  // Set the scenario prerequisite through the same persisted merchant rules as the kill switch.
  const status = body.scenario === "paused" ? "PAUSED" : "ACTIVE";
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE merchant_subscriptions SET status=? WHERE id=?").run(status, id);
    db.prepare("UPDATE merchant_rules SET status=?,expected_max_amount=? WHERE subscription_id=?").run(status, Number(sub.expected_amount), id);
    db.prepare("UPDATE merchant_subscriptions SET expected_max_amount=? WHERE id=?").run(Number(sub.expected_amount), id);
    db.exec("COMMIT");
  } catch { db.exec("ROLLBACK"); return Response.json({ error: "Could not prepare simulation" }, { status: 500 }); }
  const started = performance.now();
  const result = authorize(db, { authorization_id: `demo_${randomUUID()}`, provider_card_id: String(card.provider_card_id), merchant_descriptor: String(sub.merchant_descriptor), amount: Math.round(Number(sub.expected_amount) * (body.scenario === "hike" ? 1.2 : 1)), currency: sub.currency as Currency });
  return Response.json({ ...result.body, http_status: result.status, duration_ms: Number((performance.now() - started).toFixed(2)), state: dashboard(auth.userId) });
}
