import { type CardStatus, type CardCurrency } from './cardProvider.js';

// ISO 8583 response codes the issuer must answer with for a provider authorization.
export const ISO_8583_RESPONSE_CODES = {
  APPROVE: '00',
  INSUFFICIENT_FUNDS: '51',
  PRICE_LIMIT: '61',
  CARD_FROZEN: '62',
  NOT_PERMITTED: '57',
  SYSTEM_FAILURE: '96',
} as const;

export type AuthorizationStatus =
  | 'APPROVED'
  | 'DECLINED_KILL_SWITCH'
  | 'DECLINED_PRICE_HIKE'
  | 'DECLINED_INSUFFICIENT_FUNDS'
  | 'DECLINED_UNKNOWN_MERCHANT'
  | 'DECLINED_CURRENCY_MISMATCH'
  | 'DECLINED_CARD_FROZEN';

export type DeclineReason =
  | 'payment_approved'
  | 'merchant_killed'
  | 'merchant_unknown'
  | 'card_frozen'
  | 'price_hike'
  | 'currency_mismatch'
  | 'insufficient_funds';

export interface AuthorizationWalletState {
  ngnBalanceMinor: number;
  usdBalanceMinor: number;
  autoFxEnabled: boolean;
  fxConvertedNgn: number;
}

export interface AuthorizationContext {
  cardStatus: CardStatus;
  subscriptionStatus: 'ACTIVE' | 'PAUSED';
  merchantDescriptor: string;
  approvedAmountMinor: number;
  approvedMaxAmountMinor: number;
  approvedCurrency: CardCurrency;
  chargedCurrency: CardCurrency;
  wallet: AuthorizationWalletState;
  fxNgnPerUsd: number;
  pool?: { enabled: boolean; fallbackEnabled: boolean; poolBalanceMinor: number };
}

export interface AuthorizationDecision {
  status: AuthorizationStatus;
  approved: boolean;
  declineReason?: DeclineReason;
  responseCode: string;
  amountMinor: number;
  currency: CardCurrency;
  fxNgnAmount: number;
  poolAmount: number;
}

// Pure decision function: no database, network, or issuer I/O happens here.
// Every rule is evaluated before the card issuer is asked to respond, so the
// financial path stays deterministic and unit-testable.
export function evaluateAuthorization(input: AuthorizationContext): AuthorizationDecision {
  const amountMinor = input.approvedAmountMinor;
  const currency = input.approvedCurrency;

  const decline = (status: AuthorizationStatus, declineReason: DeclineReason, responseCode: string, fxNgnAmount = 0, poolAmount = 0): AuthorizationDecision => ({
    status,
    approved: false,
    declineReason,
    responseCode,
    amountMinor,
    currency,
    fxNgnAmount,
    poolAmount,
  });

  const approve = (fxNgnAmount: number, poolAmount: number): AuthorizationDecision => ({
    status: 'APPROVED',
    approved: true,
    responseCode: ISO_8583_RESPONSE_CODES.APPROVE,
    amountMinor,
    currency,
    fxNgnAmount,
    poolAmount,
  });

  if (!input.merchantDescriptor) {
    return decline('DECLINED_UNKNOWN_MERCHANT', 'merchant_unknown', ISO_8583_RESPONSE_CODES.NOT_PERMITTED);
  }
  if (input.subscriptionStatus !== 'ACTIVE') {
    return decline('DECLINED_KILL_SWITCH', 'merchant_killed', ISO_8583_RESPONSE_CODES.NOT_PERMITTED);
  }
  if (input.cardStatus !== 'ACTIVE') {
    return decline('DECLINED_CARD_FROZEN', 'card_frozen', ISO_8583_RESPONSE_CODES.CARD_FROZEN);
  }
  if (input.chargedCurrency !== input.approvedCurrency) {
    return decline('DECLINED_CURRENCY_MISMATCH', 'currency_mismatch', ISO_8583_RESPONSE_CODES.NOT_PERMITTED);
  }
  if (amountMinor > input.approvedMaxAmountMinor) {
    return decline('DECLINED_PRICE_HIKE', 'price_hike', ISO_8583_RESPONSE_CODES.PRICE_LIMIT);
  }

  const poolAmount = input.pool?.enabled ? Math.min(input.pool.poolBalanceMinor, amountMinor) : 0;
  const hostAmount = amountMinor - poolAmount;

  // An enabled split pool that is short and has host fallback disabled fails closed.
  if (hostAmount > 0 && input.pool?.enabled && !input.pool.fallbackEnabled) {
    return decline('DECLINED_INSUFFICIENT_FUNDS', 'insufficient_funds', ISO_8583_RESPONSE_CODES.INSUFFICIENT_FUNDS, 0, poolAmount);
  }

  if (hostAmount > 0) {
    if (input.approvedCurrency === 'USD') {
      const availableUsd = input.wallet.usdBalanceMinor;
      const shortfallUsd = Math.max(0, hostAmount - availableUsd);
      if (shortfallUsd > 0) {
        if (!input.wallet.autoFxEnabled) {
          return decline('DECLINED_INSUFFICIENT_FUNDS', 'insufficient_funds', ISO_8583_RESPONSE_CODES.INSUFFICIENT_FUNDS, 0, poolAmount);
        }
        const requiredNgn = Math.ceil(shortfallUsd * input.fxNgnPerUsd);
        if (input.wallet.ngnBalanceMinor < requiredNgn) {
          return decline('DECLINED_INSUFFICIENT_FUNDS', 'insufficient_funds', ISO_8583_RESPONSE_CODES.INSUFFICIENT_FUNDS, requiredNgn, poolAmount);
        }
        return approve(requiredNgn, poolAmount);
      }
      return approve(0, poolAmount);
    }
    if (input.wallet.ngnBalanceMinor < hostAmount) {
      return decline('DECLINED_INSUFFICIENT_FUNDS', 'insufficient_funds', ISO_8583_RESPONSE_CODES.INSUFFICIENT_FUNDS, 0, poolAmount);
    }
  }

  return approve(0, poolAmount);
}
