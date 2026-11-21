import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Currency, DemoScenario } from "@retrest/shared";
import type { AppContext } from "../context.ts";
import { dashboardFor } from "../context.ts";
import { seedDatabase, transaction } from "../db/database.ts";
import { objectBody, sendError, sendFailure } from "../lib/http.ts";
import { requireDemo, requireSession, sessionUser } from "../middleware/session.ts";
import { authorize } from "../services/authorization.ts";

/** Which seeded merchant each simulator scenario charges. */
const SCENARIO_MERCHANT: Record<DemoScenario, string> = {
  normal: "spotify",
  hike: "spotify",
  paused: "youtube",
  fx: "chatgpt",
  pool: "netflix",
};
const isScenario = (value: unknown): value is DemoScenario => typeof value === "string" && value in SCENARIO_MERCHANT;

export function demoRoutes(context: AppContext) {
  const { db, config } = context;
  const router = Router();
  router.use(requireSession(config));

  // Run a simulated issuer charge through the real authorization engine.
  router.post("/", requireDemo(config, "Demo simulator disabled"), (request, response) => {
    const userId = sessionUser(response);
    const body = objectBody(request);
    if (!body || !isScenario(body.scenario)) return sendError(response, 400, "Unknown scenario");
    const scenario = body.scenario;
    const id = SCENARIO_MERCHANT[scenario];
    const subscription = db.prepare("SELECT * FROM merchant_subscriptions WHERE id=? AND user_id=?").get(id, userId);
    const card = db.prepare("SELECT provider_card_id FROM virtual_cards WHERE user_id=?").get(userId);
    if (!subscription || !card) return sendError(response, 404, "Demo data unavailable");

    // Set the scenario prerequisite through the same persisted merchant rules as the kill switch.
    const status = scenario === "paused" ? "PAUSED" : "ACTIVE";
    const expected = Number(subscription.expected_amount);
    try {
      transaction(db, () => {
        db.prepare("UPDATE merchant_subscriptions SET status=?,expected_max_amount=? WHERE id=?").run(status, expected, id);
        db.prepare("UPDATE merchant_rules SET status=?,expected_max_amount=? WHERE subscription_id=?").run(status, expected, id);
      });
    } catch (error) {
      return sendFailure(response, error, "Could not prepare simulation");
    }

    const started = performance.now();
    const result = authorize(db, {
      authorization_id: `demo_${randomUUID()}`,
      provider_card_id: String(card.provider_card_id),
      merchant_descriptor: String(subscription.merchant_descriptor),
      amount: Math.round(expected * (scenario === "hike" ? 1.2 : 1)),
      currency: subscription.currency as Currency,
    });
    response.json({
      ...result.body,
      http_status: result.status,
      duration_ms: Number((performance.now() - started).toFixed(2)),
      state: dashboardFor(context, userId),
    });
  });

  // Restore the demo account to its seeded balances, merchants, and pools.
  router.post("/reset", requireDemo(config, "Demo reset disabled"), (_request, response) => {
    const userId = sessionUser(response);
    try {
      transaction(db, () => {
        db.prepare("DELETE FROM notifications WHERE user_id=?").run(userId);
        db.prepare("DELETE FROM transaction_logs WHERE user_id=?").run(userId);
        db.prepare("DELETE FROM pool_members WHERE pool_id IN (SELECT id FROM split_pools WHERE host_user_id=?)").run(userId);
        db.prepare("DELETE FROM split_pools WHERE host_user_id=?").run(userId);
        db.prepare("DELETE FROM merchant_rules WHERE user_id=?").run(userId);
        db.prepare("DELETE FROM merchant_subscriptions WHERE user_id=?").run(userId);
        db.prepare("DELETE FROM virtual_cards WHERE user_id=?").run(userId);
        db.prepare("DELETE FROM users WHERE id=?").run(userId);
      });
      seedDatabase(db);
    } catch (error) {
      return sendFailure(response, error, "Could not reset demo");
    }
    response.json(dashboardFor(context, userId));
  });

  return router;
}
