import { Router } from 'express';
import { z } from 'zod';
import { authContext } from '../middleware/auth.js';

export const settingsRouter = Router();

const patchSettings = z.object({ auto_fx_enabled: z.boolean() }).strict();

settingsRouter.get('/', async (request, response) => {
  const { user, db } = authContext(response);
  const wallet = await db.from('wallets').select('user_id, ngn_balance, usd_balance, auto_fx_enabled, fx_converted_ngn, updated_at').eq('user_id', user.id).maybeSingle();
  response.json({ wallet });
});

settingsRouter.patch('/', async (request, response) => {
  const parsed = patchSettings.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ error: 'Send only auto_fx_enabled.' }); return; }
  const { user, db } = authContext(response);
  const wallet = await db.from('wallets').update({ auto_fx_enabled: parsed.data.auto_fx_enabled, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .select('user_id, ngn_balance, usd_balance, auto_fx_enabled, fx_converted_ngn, updated_at')
    .single();
  response.json({ wallet });
});
