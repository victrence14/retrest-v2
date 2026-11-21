import { Router } from 'express';
import { z } from 'zod';
import { authContext } from '../middleware/auth.js';
import { createCardIssuer, type CardIssuer } from '../lib/cardProvider.js';
import type { Config } from '../config.js';

const updateCard = z.object({ status: z.enum(['ACTIVE', 'FROZEN']) }).strict();

export function createCardRouter(config: Config, issuer: CardIssuer) {
  const cardRouter = Router();

  cardRouter.get('/', async (request, response) => {
    const { user, db } = authContext(response);
    const card = await db.from('virtual_cards').select('id, user_id, masked_pan, expiry, status, provider_card_id, provider_customer_id, created_at').eq('user_id', user.id).maybeSingle();
    if (!card) { response.status(404).json({ error: 'No card found.' }); return; }
    response.json({ card });
  });

  cardRouter.patch('/', async (request, response) => {
    const parsed = updateCard.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'Send only status: ACTIVE or FROZEN.' }); return; }
    const { user, db } = authContext(response);
    const card = await db.from('virtual_cards').update({ status: parsed.data.status }).eq('user_id', user.id).select('id, user_id, masked_pan, expiry, status, provider_card_id, provider_customer_id, created_at').single();
    response.json({ card });
  });

  cardRouter.post('/', async (request, response) => {
    const { user, db } = authContext(response);
    const issued = await issuer.issueVirtualCard({ userId: user.id, currency: 'NGN' });
    const now = new Date().toISOString();
    const card = await db.from('virtual_cards').upsert({
      user_id: user.id, masked_pan: issued.maskedPan, expiry: issued.expiry, status: 'ACTIVE',
      provider_card_id: issued.providerCardId, provider_customer_id: issued.providerCustomerId, created_at: now,
    }, { onConflict: 'user_id' }).select('id, user_id, masked_pan, expiry, status, provider_card_id, provider_customer_id, created_at').single();
    const wallet = await db.from('wallets').upsert({
      user_id: user.id, ngn_balance: 0, usd_balance: 0, auto_fx_enabled: true, fx_converted_ngn: 0, updated_at: now,
    }, { onConflict: 'user_id' }).select('user_id, ngn_balance, usd_balance, auto_fx_enabled, fx_converted_ngn, updated_at').single();
    response.json({ card, wallet });
  });

  return cardRouter;
}
