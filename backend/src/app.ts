import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Config } from './config.js';
import { createSupabaseClients, type SupabaseClients } from './lib/supabase.js';
import { requireAuth, authContext } from './middleware/auth.js';
import { profileRouter } from './routes/profile.js';

export function createApp(config: Config, clients: SupabaseClients = createSupabaseClients(config)) {
  const app = express();
  const origins = new Set(config.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean));
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin(origin, callback) { callback(null, !origin || origins.has(origin)); } }));
  app.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'retrest-api' }));
  app.use('/api', requireAuth(clients));
  app.get('/api/me', (_request, response) => {
    const { user } = authContext(response);
    response.json({ user: { id: user.id, email: user.email } });
  });
  app.use('/api/profile', profileRouter);
  app.use((_request, response) => response.status(404).json({ error: 'Route not found.' }));
  const onError: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
    const safeStatus = status >= 400 && status < 500 ? status : 500;
    response.status(safeStatus).json({ error: safeStatus === 500 ? 'An unexpected server error occurred.' : 'Invalid request.' });
  };
  app.use(onError);
  return app;
}
