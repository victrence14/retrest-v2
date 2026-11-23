import express, { Router } from "express";
import type { Config } from "../../config.ts";
import type { SupabaseClients } from "../../lib/supabase.ts";
import { sendError } from "../../lib/http.ts";
import { requireAuth } from "../../middleware/supabase-auth.ts";
import { requireVerifiedAccount } from "../../middleware/account-auth.ts";
import { rateLimit, type RateLimitStore } from "../../middleware/rate-limit.ts";
import { accountFeatureRoutes } from "./account.routes.ts";
import { insightFeatureRoutes } from "./insights.routes.ts";
import { poolFeatureRoutes } from "./pools.routes.ts";
import { subscriptionFeatureRoutes } from "./subscriptions.routes.ts";
import { supportFeatureRoutes } from "./support.routes.ts";
import { transactionFeatureRoutes } from "./transactions.routes.ts";

export function featureRoutes(config: Config, clients: SupabaseClients | null, limits: RateLimitStore) {
  const router = Router();
  router.use(rateLimit(limits, "features", 300, 60_000));
  if (!clients) {
    router.use((_request, response) => sendError(response, 503, "Supabase account features are not configured."));
    return router;
  }
  router.use(express.json({ limit: "32kb" }), requireAuth(clients), requireVerifiedAccount);
  router.use(accountFeatureRoutes());
  router.use("/subscriptions", subscriptionFeatureRoutes());
  router.use(poolFeatureRoutes());
  router.use(transactionFeatureRoutes());
  router.use(insightFeatureRoutes(config));
  router.use("/support", supportFeatureRoutes(config, limits));
  // Unknown versioned paths never fall through to the demo workspace.
  router.use((_request, response) => sendError(response, 404, "Account API route not found."));
  return router;
}
