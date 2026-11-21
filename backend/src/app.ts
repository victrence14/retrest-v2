import express from "express";
import cors from "cors";
import helmet from "helmet";
import type { DatabaseSync } from "node:sqlite";
import type { Config } from "./config.ts";
import type { AppContext } from "./context.ts";
import { openDatabase } from "./db/database.ts";
import { errorHandler, sendError, tolerateMalformedJson } from "./lib/http.ts";
import { createSupabaseClients, type SupabaseClients } from "./lib/supabase.ts";
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
}

export function createApp(config: Config, dependencies: AppDependencies = {}) {
  const context: AppContext = { config, db: dependencies.db ?? openDatabase(config.databasePath) };
  const supabase =
    dependencies.supabase !== undefined
      ? dependencies.supabase
      : config.supabase
        ? createSupabaseClients(config.supabase)
        : null;

  const app = express();
  const origins = new Set(config.corsOrigins);
  // The Next.js frontend proxies /api on loopback; trust its X-Forwarded-* headers only from there.
  app.set("trust proxy", "loopback");
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ credentials: true, origin: (origin, callback) => callback(null, !origin || origins.has(origin)) }));
  app.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (_request, response) => response.json({ status: "ok", service: "retrest-api" }));

  // Issuer webhooks authenticate by signature over the raw body, not by cookie or origin.
  app.use("/api/webhooks", webhookRoutes(context));

  // Supabase-authenticated account routes (Bearer token).
  app.use("/api", profileRoutes(supabase));

  // Cookie-authenticated demo workspace routes.
  const cookieApi = express.Router();
  cookieApi.use(express.json({ limit: "16kb" }), tolerateMalformedJson, requireTrustedOrigin(config));
  cookieApi.use(sessionRoutes(context));
  cookieApi.use(accountRoutes(context));
  cookieApi.use(documentRoutes(context));
  cookieApi.use("/subscriptions", subscriptionRoutes(context));
  cookieApi.use("/pools", poolRoutes(context));
  cookieApi.use("/demo", demoRoutes(context));
  cookieApi.use("/invites", inviteRoutes(context));
  app.use("/api", cookieApi);

  app.use((_request, response) => sendError(response, 404, "Route not found."));
  app.use(errorHandler);
  return app;
}
