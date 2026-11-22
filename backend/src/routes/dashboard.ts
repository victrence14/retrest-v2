import { Router } from 'express';
import { authContext } from '../middleware/auth.js';

export const dashboardRouter = Router();

// Owner-scoped financial snapshot for the workspace shell.
dashboardRouter.get('/', async (request, response) => {
  const { user, db } = authContext(response);

  const profile = await db.from('profiles').select('id, display_name, created_at, updated_at').eq('id', user.id).maybeSingle();
  const wallet = await db.from('wallets').select('user_id, ngn_balance, usd_balance, auto_fx_enabled, fx_converted_ngn, updated_at').eq('user_id', user.id).maybeSingle();
  const card = await db.from('virtual_cards').select('id, user_id, masked_pan, expiry, status, provider_card_id, provider_customer_id, created_at').eq('user_id', user.id).maybeSingle();
  const subscriptions = await db.from('subscriptions').select(
    'id, user_id, name, category_slug, amount_minor, currency, active, merchant_name, merchant_descriptor, max_amount_minor, billing_cycle, next_billing_date, is_business_expense, needs_review, plan_name, created_at, updated_at',
  ).eq('user_id', user.id).order('next_billing_date', { ascending: true });
  const pools = await db.from('split_pools').select(
    'id, subscription_id, host_user_id, name, pool_balance, target_amount, currency, status, fallback_enabled, invite_token, created_at, updated_at, subscriptions (id, name, currency, next_billing_date)',
  ).eq('host_user_id', user.id);
  const transactions = await db.from('transactions').select(
    'id, authorization_id, user_id, subscription_id, merchant_name, amount_minor, currency, status, decline_reason, receipt_url, fx_ngn_amount, pool_amount, http_status, response_json, created_at',
  ).eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
  const notifications = await db.from('notifications').select(
    'id, user_id, subscription_id, transaction_id, title, message, read_at, created_at',
  ).eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);

  response.json({ profile, wallet, card, subscriptions, pools, transactions, notifications });
});
