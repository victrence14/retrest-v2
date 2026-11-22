import { Router } from 'express';
import { z } from 'zod';
import { authContext } from '../middleware/auth.js';
import { resolveFxNgnPerUsd, type Config } from '../config.js';
import type { CardIssuer } from '../lib/cardProvider.js';

export function createWalletRouter(config: Config, issuer: CardIssuer) {
  const walletRouter = Router();
  const walletSelect = 'user_id, ngn_balance, usd_balance, auto_fx_enabled, fx_converted_ngn, updated_at';

  walletRouter.get('/', async (request, response) => {
    const { user, db } = authContext(response);
    const wallet = await db.from('wallets').select(walletSelect).eq('user_id', user.id).maybeSingle();
    if (!wallet) { response.status(404).json({ error: 'Wallet not found.' }); return; }
    response.json({ wallet });
  });

  walletRouter.post('/fund', async (request, response) => {
    const parsed = z.object({ currency: z.enum(['NGN', 'USD']), amount_minor: z.number().int().positive() }).strict().safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'Send a valid currency and positive integer amount_minor.' }); return; }
    const { user, db } = authContext(response);
    const demoEnabled = process.env.RETREST_DEMO_ENABLED !== 'false';
    if (!demoEnabled) { response.status(403).json({ error: 'Wallet funding is unavailable in this environment.' }); return; }
    const walletBefore = await db.from('wallets').select('ngn_balance, usd_balance').eq('user_id', user.id).maybeSingle();
    if (!walletBefore) { response.status(404).json({ error: 'Wallet not found.' }); return; }
    const currentBalance = parsed.data.currency === 'USD' ? (walletBefore.data?.usd_balance ?? 0) : (walletBefore.data?.ngn_balance ?? 0);
    const wallet = parsed.data.currency === 'USD'
      ? await db.from('wallets').update({ usd_balance: currentBalance + parsed.data.amount_minor, updated_at: new Date().toISOString() }).eq('user_id', user.id).select(walletSelect).single()
      : await db.from('wallets').update({ ngn_balance: currentBalance + parsed.data.amount_minor, updated_at: new Date().toISOString() }).eq('user_id', user.id).select(walletSelect).single();
    response.json({ wallet });
  });

  walletRouter.get('/fx-quote', async (request, response) => {
    const parsed = z.object({ amount_minor: z.number().int().positive(), currency: z.enum(['NGN', 'USD']) }).strict().safeParse(request.query);
    if (!parsed.success) { response.status(400).json({ error: 'Send amount_minor and currency.' }); return; }
    const transferRate = await issuer.getTransferRate('USDNGN');
    const rate = transferRate?.rate ?? resolveFxNgnPerUsd(config);
    const amountMinor = parsed.data.amount_minor;
    const fxNgnMinor = parsed.data.currency === 'USD' ? Math.ceil(amountMinor * rate) : amountMinor;
    response.json({ amount_minor: amountMinor, currency: parsed.data.currency, rate_ngn_per_usd: rate, fx_ngn_minor: fxNgnMinor });
  });

  return walletRouter;
}
