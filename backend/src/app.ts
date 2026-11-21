import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Config } from './config.js';
import { createSupabaseClients, type SupabaseClients } from './lib/supabase.js';
import { requireAuth, authContext } from './middleware/auth.js';
import { profileRouter } from './routes/profile.js';
import { dashboardRouter } from './routes/dashboard.js';
import { createCardRouter } from './routes/card.js';
import { createWalletRouter } from './routes/wallet.js';
import { createAuthorizationRouter } from './routes/authorizations.js';
import { createProductRouter } from './routes/productRouter.js';
import { createPublicInvitesRouter } from './routes/publicInvitesRouter.js';
import { createWebhookRouter } from './routes/webhooks.js';
import { createCardIssuer } from './lib/cardProvider.js';
import { openApiDocument } from './openapi.js';

export function createApp(config: Config, clients: SupabaseClients = createSupabaseClients(config)) {
  const app = express();
  const origins = new Set(config.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean));
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin(origin, callback) { callback(null, !origin || origins.has(origin)); } }));
  app.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/openapi.json', (_request, response) => response.json(openApiDocument));
  app.get('/api/docs', (_request, response) => {
    response.type('html').send('<!doctype html><html><head><meta charset="utf-8"><title>Retrest API</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script><script>window.onload = function() { window.ui = SwaggerUIBundle({ url: "/api/openapi.json", dom_id: "#swagger-ui", deepLinking: true, presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset], layout: "StandaloneLayout" }); };</script></body></html>');
  });
  app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'retrest-api' }));
  // The invite preview is the only unauthenticated product route.
  app.use('/api/invites', createPublicInvitesRouter(clients.auth));
  app.use('/api', requireAuth(clients));
  app.get('/api/me', (_request, response) => {
    const { user } = authContext(response);
    response.json({ user: { id: user.id, email: user.email } });
  });
  app.use('/api/profile', profileRouter);
  app.use('/api/dashboard', dashboardRouter);
  const cardIssuer = createCardIssuer(config);
  app.use('/api/card', createCardRouter(config, cardIssuer));
  app.use('/api/wallet', createWalletRouter(config, cardIssuer));
  app.use('/api/authorizations', createAuthorizationRouter(config, cardIssuer));
  // BE1 mounts the whole product domain here.
  app.use('/api', createProductRouter());
  app.use('/api/webhooks', createWebhookRouter(config, cardIssuer));
  app.use((_request, response) => response.status(404).json({ error: 'Route not found.' }));
  const onError: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
    const safeStatus = status >= 400 && status < 500 ? status : 500;
    response.status(safeStatus).json({ error: safeStatus === 500 ? 'An unexpected server error occurred.' : 'Invalid request.' });
  };
  app.use(onError);
  return app;
}
