import express from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "./config.ts";
import type { AppContext } from "./context.ts";
import { openDatabase } from "./db/database.ts";
import { errorHandler, HttpError, sendError, tolerateMalformedJson } from "./lib/http.ts";
import { createAdminClient, createSupabaseClients, type SupabaseClients } from "./lib/supabase.ts";
import { createAuthGateway, type AuthGateway } from "./services/auth-gateway.ts";
import { MemoryRateLimitStore, type RateLimitStore } from "./middleware/rate-limit.ts";
import { authenticationRoutes } from "./routes/auth.routes.ts";
import { featureRoutes } from "./routes/features/index.ts";
import { demoTransactionRoutes } from "./routes/transactions.routes.ts";
import { databaseResult } from "./lib/database-result.ts";
import { providerWebhookRoutes } from "./routes/provider-webhooks.routes.ts";
import { requireTrustedOrigin } from "./middleware/session.ts";
import { accountRoutes } from "./routes/account.routes.ts";
import { demoRoutes } from "./routes/demo.routes.ts";
import { documentRoutes } from "./routes/documents.routes.ts";
import { inviteRoutes } from "./routes/invites.routes.ts";
import { poolRoutes } from "./routes/pools.routes.ts";
import { profileRoutes } from "./routes/profile.routes.ts";
import { sessionRoutes } from "./routes/session.routes.ts";
import { subscriptionRoutes } from "./routes/subscriptions.routes.ts";
import { webhookRoutes } from "./routes/webhooks.routes.ts";

export interface AppDependencies {
  db?: DatabaseSync;
  supabase?: SupabaseClients | null;
  authGateway?: AuthGateway | null;
  rateLimitStore?: RateLimitStore;
  admin?: SupabaseClient | null;
}

export function createApp(config: Config, dependencies: AppDependencies = {}) {
  const context: AppContext = { config, db: dependencies.db ?? openDatabase(
    config.demoEnabled ? config.databasePath : ":memory:", { seed: config.demoEnabled },
  ) };
  const supabase =
    dependencies.supabase !== undefined
      ? dependencies.supabase
      : config.supabase
        ? createSupabaseClients(config.supabase)
        : null;

  const app = express();
  const limits = dependencies.rateLimitStore ?? new MemoryRateLimitStore();
  const gateway = dependencies.authGateway !== undefined ? dependencies.authGateway
    : config.supabase ? createAuthGateway(config.supabase) : null;
  const admin = dependencies.admin !== undefined ? dependencies.admin
    : config.supabase?.serviceRoleKey ? createAdminClient(config.supabase) : null;
  let closed = false;
  app.locals.close = () => { if (!closed && !dependencies.db) { closed = true; context.db.close(); } };
  const origins = new Set(config.corsOrigins);
  // Trust forwarded protocol/IP only from explicitly configured proxy addresses.
  app.set("trust proxy", config.trustProxy ?? "loopback");
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ credentials: true, origin: (origin, callback) => callback(null, !origin || origins.has(origin)) }));
  app.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });
  app.use((request, response, next) => {
    const requestId = request.get("x-request-id");
    response.locals.requestId = requestId && /^[a-f0-9-]{36}$/i.test(requestId) ? requestId : randomUUID();
    response.set("X-Request-ID", response.locals.requestId);
    const started = performance.now();
    response.once("finish", () => {
      if (config.nodeEnv !== "test") console.log(JSON.stringify({
        event: "request", request_id: response.locals.requestId, method: request.method,
        route: typeof request.route?.path === "string" ? request.route.path : "unmatched",
        status: response.statusCode, duration_ms: Math.round(performance.now() - started),
      }));
    });
    next();
  });

  app.get("/api/health", (_request, response) => response.json({
    status: "ok", service: "retrest-api", test_instance: config.nodeEnv === "test" && config.databasePath === ":memory:" && config.demoEnabled,
  }));
  app.get("/api/ready", async (_request, response) => {
    if (config.demoEnabled) context.db.prepare("SELECT 1").get();
    if (supabase) {
      const revision = databaseResult<string>(await supabase.auth.rpc("backend_readiness"));
      // This release requires the monthly scheduler; newer additive migrations remain compatible.
      if (typeof revision !== "string" || !/^\d{14}$/.test(revision) || revision < "20261123000000")
        throw new HttpError(503, "Account database upgrade required.");
    }
    response.json({ status: "ready", service: "retrest-api" });
  });

  // Issuer webhooks authenticate by signature over the raw body, not by cookie or origin.
  app.use("/api/webhooks", providerWebhookRoutes(config, admin));
  app.use("/api/webhooks", webhookRoutes(context));
  app.use("/api/auth", authenticationRoutes(config, supabase, gateway, limits));
  app.use("/api/v1", featureRoutes(config, supabase, limits));

  // Supabase-authenticated account routes (Bearer token).
  app.use("/api", profileRoutes(supabase));

  // Cookie-authenticated demo workspace routes.
  const cookieApi = express.Router();
  cookieApi.use(express.json({ limit: "16kb" }), tolerateMalformedJson, requireTrustedOrigin(config));
  cookieApi.use(sessionRoutes(context));
  cookieApi.use(accountRoutes(context));
  cookieApi.use(documentRoutes(context));
  cookieApi.use(demoTransactionRoutes(context));
  cookieApi.use("/subscriptions", subscriptionRoutes(context));
  cookieApi.use("/pools", poolRoutes(context));
  cookieApi.use("/demo", demoRoutes(context));
  cookieApi.use("/invites", inviteRoutes(context));
  app.use("/api", cookieApi);

  app.use((_request, response) => sendError(response, 404, "Route not found."));
  app.use(errorHandler);
  return app;
}
