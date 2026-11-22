import { Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import express from 'express';
import { createAdminClient } from '../lib/supabase.js';
import { createCardIssuer, type CardIssuer } from '../lib/cardProvider.js';
import { authorizeProviderPayment } from '../lib/authorizationService.js';
import type { Config } from '../config.js';

const webhookRequest = z.object({
  authorization_id: z.string().min(1).max(128),
  provider_card_id: z.string().min(1).max(128),
  merchant_descriptor: z.string().trim().min(1).max(128),
  amount_minor: z.number().int().positive(),
  currency: z.enum(['NGN', 'USD']),
}).strict();

const MAX_WEBHOOK_BODY_BYTES = 8192;

export function createWebhookRouter(config: Config, issuer: CardIssuer) {
  const webhookRouter = Router();

  webhookRouter.use(express.raw({ type: 'application/json', limit: '8kb' }));

  webhookRouter.post('/card-auth', async (request, response) => {
    const secret = config.SUDO_WEBHOOK_SECRET;
    if (!secret) { response.status(503).json({ error: 'Issuer webhook secret is not configured' }); return; }
    const raw = Buffer.isBuffer(request.body) ? (request.body as Buffer).toString('utf8') : JSON.stringify(request.body ?? {});
    if (Buffer.byteLength(raw, 'utf8') > MAX_WEBHOOK_BODY_BYTES) { response.status(413).json({ error: 'Payload too large' }); return; }
    const timestamp = String(request.headers['x-retrest-timestamp'] ?? '');
    const signature = String(request.headers['x-retrest-signature'] ?? '');
    const expected = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
    if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !/^[a-f0-9]{64}$/i.test(signature) || !timingSafeEqual(Buffer.from(signature.toLowerCase()), Buffer.from(expected))) {
      response.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }
    let parsedPayload: unknown;
    try { parsedPayload = JSON.parse(raw); } catch { response.status(400).json({ error: 'Invalid JSON' }); return; }
    const parsed = webhookRequest.safeParse(parsedPayload);
    if (!parsed.success) { response.status(400).json({ error: 'Invalid authorization payload; amounts must be positive integer minor units' }); return; }

    const db = createAdminClient(config);
    const card = await db.from('virtual_cards').select('id, user_id, status, provider_card_id, provider_customer_id, masked_pan, expiry').eq('provider_card_id', parsed.data.provider_card_id).maybeSingle();
    const ownerUserId = card?.data?.user_id;
    if (!ownerUserId) { response.status(404).json({ error: 'Unknown card' }); return; }

    const outcome = await authorizeProviderPayment({
      db,
      issuer,
      config,
      userId: ownerUserId,
      payload: { authorization_id: parsed.data.authorization_id, provider_card_id: parsed.data.provider_card_id, merchant_descriptor: parsed.data.merchant_descriptor, amount_minor: parsed.data.amount_minor, currency: parsed.data.currency },
    });

    response.set('X-Idempotent-Replay', String(outcome.replayed));
    response.status(outcome.status).json(outcome.body);
  });

  return webhookRouter;
}
