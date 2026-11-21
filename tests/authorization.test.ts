import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAuthorization, ISO_8583_RESPONSE_CODES } from '../backend/src/lib/authorization.js';
import type { AuthorizationContext } from '../backend/src/lib/authorization.js';

function context(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  return {
    cardStatus: 'ACTIVE',
    subscriptionStatus: 'ACTIVE',
    merchantDescriptor: 'NETFLIX',
    approvedAmountMinor: 1500,
    approvedMaxAmountMinor: 1500,
    approvedCurrency: 'NGN',
    chargedCurrency: 'NGN',
    wallet: { ngnBalanceMinor: 1_000_000, usdBalanceMinor: 25_000, autoFxEnabled: true, fxConvertedNgn: 0 },
    fxNgnPerUsd: 1535.25,
    ...overrides,
  };
}

test('authorization approves within the wallet budget and approved maximum', () => {
  const decision = evaluateAuthorization(context());
  assert.equal(decision.status, 'APPROVED');
  assert.equal(decision.approved, true);
  assert.equal(decision.responseCode, ISO_8583_RESPONSE_CODES.APPROVE);
  assert.equal(decision.amountMinor, 1500);
  assert.equal(decision.currency, 'NGN');
  assert.equal(decision.fxNgnAmount, 0);
  assert.equal(decision.poolAmount, 0);
});

test('authorization fails closed on insufficient funds and answers with ISO 8583 code 51', () => {
  const decision = evaluateAuthorization(context({ wallet: { ngnBalanceMinor: 100, usdBalanceMinor: 0, autoFxEnabled: true, fxConvertedNgn: 0 } }));
  assert.equal(decision.status, 'DECLINED_INSUFFICIENT_FUNDS');
  assert.equal(decision.approved, false);
  assert.equal(decision.declineReason, 'insufficient_funds');
  assert.equal(decision.responseCode, ISO_8583_RESPONSE_CODES.INSUFFICIENT_FUNDS);
});

test('authorization blocks a charge above the approved maximum with ISO 8583 code 61', () => {
  const decision = evaluateAuthorization(context({ approvedAmountMinor: 2000, approvedMaxAmountMinor: 1500 }));
  assert.equal(decision.status, 'DECLINED_PRICE_HIKE');
  assert.equal(decision.responseCode, ISO_8583_RESPONSE_CODES.PRICE_LIMIT);
});

test('authorization blocks when the master card is frozen with ISO 8583 code 62', () => {
  const decision = evaluateAuthorization(context({ cardStatus: 'FROZEN' }));
  assert.equal(decision.status, 'DECLINED_CARD_FROZEN');
  assert.equal(decision.responseCode, ISO_8583_RESPONSE_CODES.CARD_FROZEN);
});

test('authorization fails closed for an unknown merchant with ISO 8583 code 57', () => {
  const decision = evaluateAuthorization(context({ merchantDescriptor: '' }));
  assert.equal(decision.status, 'DECLINED_UNKNOWN_MERCHANT');
  assert.equal(decision.responseCode, ISO_8583_RESPONSE_CODES.NOT_PERMITTED);
});

test('authorization fails closed on currency mismatch with ISO 8583 code 57', () => {
  const decision = evaluateAuthorization(context({ chargedCurrency: 'USD' }));
  assert.equal(decision.status, 'DECLINED_CURRENCY_MISMATCH');
  assert.equal(decision.responseCode, ISO_8583_RESPONSE_CODES.NOT_PERMITTED);
});

test('authorization fails closed when the merchant subscription is paused by the kill switch', () => {
  const decision = evaluateAuthorization(context({ subscriptionStatus: 'PAUSED' }));
  assert.equal(decision.status, 'DECLINED_KILL_SWITCH');
  assert.equal(decision.responseCode, ISO_8583_RESPONSE_CODES.NOT_PERMITTED);
});

test('authorization auto-converts NGN to USD through the wallet when the USD balance is short', () => {
  const decision = evaluateAuthorization(context({
    approvedCurrency: 'USD',
    chargedCurrency: 'USD',
    approvedAmountMinor: 1000,
    approvedMaxAmountMinor: 1000,
    wallet: { ngnBalanceMinor: 2_000_000, usdBalanceMinor: 0, autoFxEnabled: true, fxConvertedNgn: 0 },
  }));
  assert.equal(decision.status, 'APPROVED');
  assert.equal(decision.fxNgnAmount, Math.ceil(1000 * 1535.25));
});

test('authorization refuses USD auto-conversion when the NGN balance cannot cover the quote', () => {
  const decision = evaluateAuthorization(context({
    approvedCurrency: 'USD',
    chargedCurrency: 'USD',
    approvedAmountMinor: 1000,
    approvedMaxAmountMinor: 1000,
    wallet: { ngnBalanceMinor: 100, usdBalanceMinor: 0, autoFxEnabled: true, fxConvertedNgn: 0 },
  }));
  assert.equal(decision.status, 'DECLINED_INSUFFICIENT_FUNDS');
  assert.equal(decision.responseCode, ISO_8583_RESPONSE_CODES.INSUFFICIENT_FUNDS);
});

test('authorization refuses USD auto-conversion when the owner turned auto-FX off', () => {
  const decision = evaluateAuthorization(context({
    approvedCurrency: 'USD',
    chargedCurrency: 'USD',
    approvedAmountMinor: 1000,
    approvedMaxAmountMinor: 1000,
    wallet: { ngnBalanceMinor: 2_000_000, usdBalanceMinor: 0, autoFxEnabled: false, fxConvertedNgn: 0 },
  }));
  assert.equal(decision.status, 'DECLINED_INSUFFICIENT_FUNDS');
  assert.equal(decision.responseCode, ISO_8583_RESPONSE_CODES.INSUFFICIENT_FUNDS);
});

test('authorization pays a funded split pool before falling back to the host wallet', () => {
  const decision = evaluateAuthorization(context({
    pool: { enabled: true, fallbackEnabled: true, poolBalanceMinor: 1500 },
  }));
  assert.equal(decision.status, 'APPROVED');
  assert.equal(decision.poolAmount, 1500);
});

test('authorization fails closed when a funded split pool is underfunded and host fallback is off', () => {
  const decision = evaluateAuthorization(context({
    pool: { enabled: true, fallbackEnabled: false, poolBalanceMinor: 500 },
  }));
  assert.equal(decision.status, 'DECLINED_INSUFFICIENT_FUNDS');
  assert.equal(decision.poolAmount, 500);
});
