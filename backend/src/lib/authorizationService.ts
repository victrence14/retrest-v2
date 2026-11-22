import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { evaluateAuthorization, type AuthorizationDecision } from './authorization.js';
import { resolveFxNgnPerUsd, type Config } from '../config.js';
import type { CardIssuer } from './cardProvider.js';

export interface ProviderAuthorizationPayload {
  authorization_id: string;
  provider_card_id: string;
  merchant_descriptor: string;
  amount_minor: number;
  currency: 'NGN' | 'USD';
  channel?: string;
  merchant_category?: string;
}

export interface AuthorizationOutcome {
  status: number;
  body: Record<string, unknown>;
  replayed: boolean;
}

const transactionSelect = 'id, authorization_id, user_id, subscription_id, merchant_name, amount_minor, currency, status, decline_reason, receipt_url, fx_ngn_amount, pool_amount, http_status, response_json, created_at';

export async function authorizeProviderPayment(params: {
  db: SupabaseClient;
  issuer: CardIssuer;
  config: Config;
  userId: string;
  payload: ProviderAuthorizationPayload;
}): Promise<AuthorizationOutcome> {
  const { db, issuer, config, userId, payload } = params;
  const merchantDescriptor = payload.merchant_descriptor.trim().toUpperCase();
  const event = {
    providerAuthorizationId: payload.authorization_id,
    providerCardId: payload.provider_card_id,
    merchantDescriptor,
    amountMinor: payload.amount_minor,
    currency: payload.currency,
    channel: payload.channel,
    merchantCategory: payload.merchant_category,
  };

  const existing = await db.from('transactions').select(transactionSelect).eq('authorization_id', payload.authorization_id).eq('user_id', userId).maybeSingle();
  if (existing?.data) {
    const stored = existing.data;
    return {
      status: stored.http_status,
      body: {
        decision: stored.status === 'APPROVED' ? 'APPROVE' : 'DECLINE',
        reason: stored.decline_reason ?? (stored.status === 'APPROVED' ? 'Payment approved' : 'Payment declined'),
        transaction_id: stored.id,
        receipt_url: stored.receipt_url,
        fx_ngn_amount: stored.fx_ngn_amount,
        pool_amount: stored.pool_amount,
        amount: stored.amount_minor,
        currency: stored.currency,
        merchant_name: stored.merchant_name,
        status: stored.status,
        approved: stored.status === 'APPROVED',
        replayed: true,
      },
      replayed: true,
    };
  }

  const card = await db.from('virtual_cards').select('id, user_id, status, provider_card_id, provider_customer_id, masked_pan, expiry').eq('provider_card_id', payload.provider_card_id).eq('user_id', userId).maybeSingle();
  const subscription = await db.from('subscriptions').select('id, user_id, merchant_name, merchant_descriptor, amount_minor, currency, max_amount_minor, billing_cycle, next_billing_date, status, is_business_expense').eq('user_id', userId).eq('merchant_descriptor', merchantDescriptor).maybeSingle();
  const wallet = await db.from('wallets').select('user_id, ngn_balance, usd_balance, auto_fx_enabled, fx_converted_ngn').eq('user_id', userId).maybeSingle();
  const pool = subscription?.data?.id
    ? await db.from('split_pools').select('id, subscription_id, host_user_id, name, pool_balance, target_amount, currency, status, fallback_enabled, invite_token, created_at, updated_at').eq('subscription_id', subscription.data.id).maybeSingle()
    : null;

  const transferRate = await issuer.getTransferRate('USDNGN');
  const fxNgnPerUsd = transferRate?.rate ?? resolveFxNgnPerUsd(config);

  const decision: AuthorizationDecision = evaluateAuthorization({
    cardStatus: card?.data?.status ?? 'FROZEN',
    subscriptionStatus: subscription?.data?.status ?? 'PAUSED',
    merchantDescriptor: subscription?.data?.merchant_descriptor ?? merchantDescriptor,
    approvedAmountMinor: subscription?.data?.amount_minor ?? payload.amount_minor,
    approvedMaxAmountMinor: subscription?.data?.max_amount_minor ?? payload.amount_minor,
    approvedCurrency: subscription?.data?.currency ?? payload.currency,
    chargedCurrency: payload.currency,
    wallet: {
      ngnBalanceMinor: wallet?.data?.ngn_balance ?? 0,
      usdBalanceMinor: wallet?.data?.usd_balance ?? 0,
      autoFxEnabled: wallet?.data?.auto_fx_enabled ?? true,
      fxConvertedNgn: wallet?.data?.fx_converted_ngn ?? 0,
    },
    fxNgnPerUsd,
    pool: pool?.data ? { enabled: true, fallbackEnabled: pool.data.fallback_enabled, poolBalanceMinor: pool.data.pool_balance } : undefined,
  });

  const issuerResponse = await issuer.respondToAuthorization(event, decision);
  const transactionId = randomUUID();
  const merchantName = subscription?.data?.merchant_name ?? merchantDescriptor;

  await db.from('transactions').insert({
    id: transactionId,
    authorization_id: payload.authorization_id,
    user_id: userId,
    subscription_id: subscription?.data?.id ?? null,
    merchant_name: merchantName,
    amount_minor: payload.amount_minor,
    currency: payload.currency,
    status: decision.status,
    decline_reason: decision.declineReason ?? null,
    receipt_url: decision.approved ? `/api/receipts/${transactionId}` : null,
    fx_ngn_amount: decision.fxNgnAmount,
    pool_amount: decision.poolAmount,
    http_status: issuerResponse.statusCode,
    response_json: issuerResponse.body,
  }).select('id').single();

  if (decision.approved) {
    const hostAmount = Math.max(0, payload.amount_minor - decision.poolAmount);
    if (decision.fxNgnAmount > 0) {
      await db.from('wallets').update({
        ngn_balance: (wallet?.data?.ngn_balance ?? 0) - decision.fxNgnAmount,
        usd_balance: (wallet?.data?.usd_balance ?? 0) + (hostAmount - (wallet?.data?.usd_balance ?? 0)),
        fx_converted_ngn: (wallet?.data?.fx_converted_ngn ?? 0) + decision.fxNgnAmount,
      }).eq('user_id', userId);
    } else if (hostAmount > 0) {
      const column = payload.currency === 'USD' ? 'usd_balance' : 'ngn_balance';
      await db.from('wallets').update({ [column]: (payload.currency === 'USD' ? (wallet?.data?.usd_balance ?? 0) : (wallet?.data?.ngn_balance ?? 0)) - hostAmount }).eq('user_id', userId);
    }
    if (pool?.data) {
      const nextPoolBalance = Math.max(0, pool.data.pool_balance - decision.poolAmount);
      await db.from('split_pools').update({ pool_balance: nextPoolBalance, status: nextPoolBalance === 0 ? 'PAID' : 'ACTIVE' }).eq('id', pool.data.id);
    }
    if (subscription?.data) {
      const nextBillingDate = new Date(subscription.data.next_billing_date);
      nextBillingDate.setUTCDate(nextBillingDate.getUTCDate() + (subscription.data.billing_cycle === 'YEARLY' ? 365 : 30));
      await db.from('subscriptions').update({ next_billing_date: nextBillingDate.toISOString() }).eq('id', subscription.data.id);
    }
  } else if (decision.declineReason === 'price_hike' && subscription?.data) {
    await db.from('notifications').insert({
      user_id: userId,
      subscription_id: subscription.data.id,
      transaction_id: transactionId,
      title: `${subscription.data.merchant_name} price increase blocked`,
      message: 'Review the new amount in your notifications before approving a higher merchant limit.',
    });
  }

  return {
    status: issuerResponse.statusCode,
    body: {
      decision: decision.approved ? 'APPROVE' : 'DECLINE',
      reason: decision.approved ? 'Payment approved' : decision.declineReason,
      transaction_id: transactionId,
      receipt_url: decision.approved ? `/api/receipts/${transactionId}` : null,
      fx_ngn_amount: decision.fxNgnAmount,
      pool_amount: decision.poolAmount,
      amount: payload.amount_minor,
      currency: payload.currency,
      merchant_name: merchantName,
      status: decision.status,
      approved: decision.approved,
    },
    replayed: false,
  };
}
