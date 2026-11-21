import { Router } from 'express';
import { z } from 'zod';
import { authContext } from '../middleware/auth.js';
import { authorizeProviderPayment, type ProviderAuthorizationPayload } from '../lib/authorizationService.js';
import type { CardIssuer } from '../lib/cardProvider.js';
import type { Config } from '../config.js';

const authorizeRequest = z.object({
  authorization_id: z.string().min(1).max(128),
  provider_card_id: z.string().min(1).max(128),
  merchant_descriptor: z.string().trim().min(1).max(128),
  amount_minor: z.number().int().positive(),
  currency: z.enum(['NGN', 'USD']),
  channel: z.string().optional(),
  merchant_category: z.string().optional(),
}).strict();

export function createAuthorizationRouter(config: Config, issuer: CardIssuer) {
  const authorizationRouter = Router();

  authorizationRouter.post('/', async (request, response) => {
    const parsed = authorizeRequest.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'Invalid authorization payload.' }); return; }
    const { user, db } = authContext(response);
    const outcome = await authorizeProviderPayment({
      db,
      issuer,
      config,
      userId: user.id,
      payload: {
        authorization_id: parsed.data.authorization_id,
        provider_card_id: parsed.data.provider_card_id,
        merchant_descriptor: parsed.data.merchant_descriptor,
        amount_minor: parsed.data.amount_minor,
        currency: parsed.data.currency,
        channel: parsed.data.channel,
        merchant_category: parsed.data.merchant_category,
      },
    });
    response.status(outcome.status).json(outcome.body);
  });

  return authorizationRouter;
}
