import type { RequestHandler, Response } from 'express';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { SupabaseClients } from '../lib/supabase.ts';

interface AuthContext { user: User; db: SupabaseClient; token: string }

export function requireAuth(clients: SupabaseClients): RequestHandler {
  return async (request, response, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? '');
    const token = match?.[1];
    if (!token) { response.status(401).json({ error: 'A Bearer access token is required.' }); return; }
    // getUser asks Supabase Auth to validate the signature, expiry and session.
    // Never trust a decoded payload or a user ID supplied in a request body.
    let result;
    try { result = await clients.auth.auth.getUser(token); }
    catch { response.status(503).json({ error: 'Authentication provider temporarily unavailable.' }); return; }
    const { data, error } = result;
    if (error && (error.name === 'AuthRetryableFetchError' || error.status === 429 || (typeof error.status === 'number' && error.status >= 500))) {
      response.status(503).json({ error: 'Authentication provider temporarily unavailable.' }); return;
    }
    if (error || !data.user) { response.status(401).json({ error: 'Your session is invalid or expired.' }); return; }
    response.locals.auth = { user: data.user, db: clients.forUser(token), token } satisfies AuthContext;
    next();
  };
}

export function authContext(response: Response): AuthContext {
  const context = response.locals.auth as AuthContext | undefined;
  if (!context) throw new Error('A protected route is missing requireAuth middleware.');
  return context;
}
