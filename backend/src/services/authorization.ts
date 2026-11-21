import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { EXCHANGE_RATE } from "../constants.ts";
import type {
  AuthorizationPayload,
  AuthorizationDecision,
  User,
  Card,
  Subscription,
  Pool,
} from "@retrest/shared";

export function validateAuthorization(
  value: unknown,
): value is AuthorizationPayload {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.authorization_id === "string" &&
    p.authorization_id.length > 0 &&
    p.authorization_id.length <= 128 &&
    typeof p.provider_card_id === "string" &&
    p.provider_card_id.length > 0 &&
    p.provider_card_id.length <= 128 &&
    typeof p.merchant_descriptor === "string" &&
    p.merchant_descriptor.length > 0 &&
    p.merchant_descriptor.length <= 128 &&
    Number.isSafeInteger(p.amount) &&
    Number(p.amount) > 0 &&
    Number(p.amount) <= 100000000000 &&
    (p.currency === "NGN" || p.currency === "USD")
  );
}

// Synchronous indexed reads + one atomic transaction: no network calls in the decision path.
export function authorize(
  db: DatabaseSync,
  payload: AuthorizationPayload,
): { status: number; body: AuthorizationDecision; replayed?: boolean } {
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db
      .prepare(
        "SELECT response_json,http_status FROM transaction_logs WHERE authorization_id=?",
      )
      .get(payload.authorization_id);
    if (existing) {
      db.exec("COMMIT");
      return {
        status: Number(existing.http_status),
        body: JSON.parse(String(existing.response_json)),
        replayed: true,
      };
    }
    const card = db
      .prepare("SELECT * FROM virtual_cards WHERE provider_card_id=?")
      .get(payload.provider_card_id) as unknown as Card | undefined;
    if (!card) {
      db.exec("COMMIT");
      return {
        status: 403,
        body: {
          decision: "DECLINE",
          reason: "Unknown card",
          transaction_id: "",
          receipt_url: null,
          fx_ngn_amount: 0,
          pool_amount: 0,
          amount: payload.amount,
          currency: payload.currency,
          merchant_name: payload.merchant_descriptor,
        },
      };
    }
    const user = db
      .prepare("SELECT * FROM users WHERE id=?")
      .get(card.user_id) as unknown as User;
    const subscription = db
      .prepare(
        "SELECT s.*,r.status rule_status,r.expected_max_amount rule_max FROM merchant_subscriptions s JOIN merchant_rules r ON r.subscription_id=s.id WHERE s.user_id=? AND r.merchant_descriptor=?",
      )
      .get(
        user.id,
        payload.merchant_descriptor.trim().toUpperCase(),
      ) as unknown as
      | (Subscription & { rule_status: string; rule_max: number })
      | undefined;
    const pool = subscription
      ? (db
          .prepare("SELECT * FROM split_pools WHERE subscription_id=?")
          .get(subscription.id) as unknown as Pool | undefined)
      : undefined;
    const id = randomUUID();
    let logStatus = "APPROVED";
    let reason = "Payment approved";
    let fxNgnAmount = 0;
    let poolAmount = 0;
    let hostAmount = payload.amount;
    const decline = (status: string, message: string) => {
      logStatus = status;
      reason = message;
    };

    // 1. Merchant-level kill switch always wins over price and funding checks.
    if (!subscription)
      decline(
        "DECLINED_UNKNOWN_MERCHANT",
        "Merchant is not connected to your shield",
      );
    else if (
      subscription.rule_status === "PAUSED" ||
      subscription.status === "PAUSED"
    )
      decline("DECLINED_KILL_SWITCH", "Blocked by Kill Switch");
    else if (card.card_status !== "ACTIVE")
      decline("DECLINED_CARD_FROZEN", "Master card is frozen");
    else if (payload.currency !== subscription.currency)
      decline(
        "DECLINED_CURRENCY_MISMATCH",
        "Merchant currency does not match its approved rule",
      );
    // 2. Apply the configured maximum to the issuer's minor-unit amount.
    else if (payload.amount > subscription.rule_max)
      decline("DECLINED_PRICE_HIKE", "Price Hike Blocked");
    else {
      // Determine the exact host shortfall before computing JIT FX, so funded pools never trigger needless FX.
      poolAmount = pool ? Math.min(pool.pool_balance, payload.amount) : 0;
      hostAmount = payload.amount - poolAmount;
      const available =
        payload.currency === "USD" ? user.usd_balance : user.ngn_balance;
      // 3. Quote exact missing USD cents; round NGN kobo up to preserve solvency.
      if (payload.currency === "USD" && available < hostAmount) {
        if (!user.auto_fx_enabled)
          decline(
            "DECLINED_INSUFFICIENT_FUNDS",
            "USD balance is insufficient and auto-conversion is off",
          );
        else {
          fxNgnAmount = Math.ceil((hostAmount - available) * EXCHANGE_RATE);
          if (user.ngn_balance < fxNgnAmount)
            decline(
              "DECLINED_INSUFFICIENT_FUNDS",
              "NGN balance is insufficient for automatic conversion",
            );
        }
      } else if (available < hostAmount)
        decline("DECLINED_INSUFFICIENT_FUNDS", "Insufficient wallet balance");
      // 4. Pool funds plus optional host fallback must cover the total.
      if (
        logStatus === "APPROVED" &&
        pool &&
        hostAmount > 0 &&
        !pool.fallback_enabled
      )
        decline(
          "DECLINED_INSUFFICIENT_FUNDS",
          "Split pool is underfunded and host fallback is off",
        );
    }

    const approved = logStatus === "APPROVED";
    if (approved && subscription) {
      // 5. Commit the conversion, pool debit, host debit, receipt, and billing date together.
      if (fxNgnAmount > 0)
        db.prepare(
          "UPDATE users SET ngn_balance=ngn_balance-?,usd_balance=usd_balance+?,fx_converted_ngn=fx_converted_ngn+? WHERE id=?",
        ).run(fxNgnAmount, hostAmount - user.usd_balance, fxNgnAmount, user.id);
      if (hostAmount > 0)
        db.prepare(
          `UPDATE users SET ${payload.currency === "USD" ? "usd_balance" : "ngn_balance"}=${payload.currency === "USD" ? "usd_balance" : "ngn_balance"}-? WHERE id=?`,
        ).run(hostAmount, user.id);
      if (pool && poolAmount > 0)
        db.prepare(
          "UPDATE split_pools SET pool_balance=pool_balance-?,status=CASE WHEN pool_balance-?=0 THEN 'PAID' ELSE 'ACTIVE' END WHERE id=?",
        ).run(poolAmount, poolAmount, pool.id);
      const nextDate = new Date(subscription.next_billing_date);
      nextDate.setUTCDate(
        nextDate.getUTCDate() +
          (subscription.billing_cycle === "YEARLY" ? 365 : 30),
      );
      db.prepare(
        "UPDATE merchant_subscriptions SET next_billing_date=? WHERE id=?",
      ).run(nextDate.toISOString(), subscription.id);
    }
    const body: AuthorizationDecision = {
      decision: approved ? "APPROVE" : "DECLINE",
      reason,
      transaction_id: id,
      receipt_url: approved ? `/api/receipts/${id}` : null,
      fx_ngn_amount: approved ? fxNgnAmount : 0,
      pool_amount: approved ? poolAmount : 0,
      amount: payload.amount,
      currency: payload.currency,
      merchant_name: subscription?.merchant_name ?? payload.merchant_descriptor,
    };
    const status = approved ? 200 : 403;
    db.prepare(
      "INSERT INTO transaction_logs (id,authorization_id,user_id,subscription_id,merchant_name,amount,currency,status,decline_reason,receipt_url,fx_ngn_amount,pool_amount,http_status,response_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      payload.authorization_id,
      user.id,
      subscription?.id ?? null,
      body.merchant_name,
      payload.amount,
      payload.currency,
      logStatus,
      approved ? null : reason,
      body.receipt_url,
      body.fx_ngn_amount,
      body.pool_amount,
      status,
      JSON.stringify(body),
    );
    if (logStatus === "DECLINED_PRICE_HIKE" && subscription)
      db.prepare(
        "INSERT INTO notifications (id,user_id,subscription_id,transaction_id,title,message) VALUES (?,?,?,?,?,?)",
      ).run(
        randomUUID(),
        user.id,
        subscription.id,
        id,
        `${subscription.merchant_name} price increase blocked`,
        "Review the new amount in your notifications before approving a higher merchant limit.",
      );
    db.exec("COMMIT");
    return { status, body };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
