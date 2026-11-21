import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { AppContext } from "../context.ts";
import { dashboardFor } from "../context.ts";
import { transaction } from "../db/database.ts";
import { HttpError, objectBody, sendError, sendFailure } from "../lib/http.ts";
import { balanceColumn, EMAIL_PATTERN } from "../lib/validation.ts";
import { requireSession, sessionUser } from "../middleware/session.ts";
import type { DatabaseSync } from "node:sqlite";

interface MemberInput {
  name: string;
  email: string;
  share_amount: number;
}

const isMember = (value: unknown, seen: Set<string>): value is MemberInput => {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.name === "string" &&
    !!m.name.trim() &&
    m.name.length <= 60 &&
    typeof m.email === "string" &&
    EMAIL_PATTERN.test(m.email) &&
    Number.isSafeInteger(m.share_amount) &&
    Number(m.share_amount) > 0 &&
    !seen.has(m.email.toLowerCase())
  );
};

/**
 * Marks one pending member as paid and adds their share to the pool.
 * A member with a linked account pays from their own wallet. Shared by the host's
 * dashboard and the public invite page. Must run inside a transaction.
 */
export function settleContribution(
  db: DatabaseSync,
  member: Record<string, unknown>,
  currency: unknown,
  insufficientMessage: string,
) {
  if (member.user_id) {
    const column = balanceColumn(currency);
    const share = Number(member.share_amount);
    const debit = db
      .prepare(`UPDATE users SET ${column}=${column}-? WHERE id=? AND ${column}>=?`)
      .run(share, String(member.user_id), share);
    if (!debit.changes) throw new HttpError(400, insufficientMessage);
  }
  db.prepare("UPDATE pool_members SET payment_status='PAID',auto_debit_scheduled=0 WHERE id=?").run(String(member.id));
  db.prepare("UPDATE split_pools SET pool_balance=pool_balance+?,status='ACTIVE' WHERE id=?").run(
    Number(member.share_amount),
    String(member.pool_id),
  );
}

export function poolRoutes(context: AppContext) {
  const { db, config } = context;
  const router = Router();
  router.use(requireSession(config));

  // Create a split pool whose member shares add up exactly to the subscription amount.
  router.post("/", (request, response) => {
    const userId = sessionUser(response);
    const body = objectBody(request);
    if (
      !body ||
      typeof body.subscription_id !== "string" ||
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.length > 60 ||
      !Array.isArray(body.members) ||
      body.members.length < 2 ||
      body.members.length > 10
    )
      return sendError(response, 400, "Choose a subscription, pool name, and 2–10 members");

    const subscription = db
      .prepare("SELECT * FROM merchant_subscriptions WHERE id=? AND user_id=?")
      .get(body.subscription_id, userId);
    if (!subscription) return sendError(response, 404, "Subscription not found");
    if (db.prepare("SELECT id FROM split_pools WHERE subscription_id=?").get(body.subscription_id))
      return sendError(response, 409, "This subscription already has a pool");

    const emails = new Set<string>();
    const members: MemberInput[] = [];
    let total = 0;
    for (const member of body.members) {
      if (!isMember(member, emails)) return sendError(response, 400, "Each member needs a unique email, name, and positive share");
      emails.add(member.email.toLowerCase());
      members.push(member);
      total += member.share_amount;
    }
    if (total !== Number(subscription.expected_amount))
      return sendError(response, 400, "Member shares must equal the subscription total");
    const hostEmail = String(db.prepare("SELECT email FROM users WHERE id=?").get(userId)?.email).toLowerCase();
    if (!emails.has(hostEmail)) return sendError(response, 400, "Include yourself as the pool host");

    const id = randomUUID();
    const inviteToken = randomUUID();
    try {
      transaction(db, () => {
        db.prepare(
          "INSERT INTO split_pools (id,subscription_id,host_user_id,name,target_amount,currency,invite_token,fallback_enabled) VALUES (?,?,?,?,?,?,?,?)",
        ).run(
          id,
          body.subscription_id as string,
          userId,
          String(body.name).trim(),
          Number(subscription.expected_amount),
          String(subscription.currency),
          inviteToken,
          body.fallback_enabled === false ? 0 : 1,
        );
        const insert = db.prepare(
          "INSERT INTO pool_members (id,pool_id,user_id,name,email,share_amount,payment_status) VALUES (?,?,?,?,?,?,'PENDING')",
        );
        for (const member of members) {
          const email = member.email.toLowerCase();
          insert.run(randomUUID(), id, email === hostEmail ? userId : null, member.name.trim(), email, member.share_amount);
        }
      });
    } catch (error) {
      return sendFailure(response, error, "Could not create pool");
    }
    response.json({ state: dashboardFor(context, userId), invite_token: inviteToken });
  });

  // Toggle host fallback, or settle one member's contribution (demo mode).
  router.patch("/:id", (request, response) => {
    const userId = sessionUser(response);
    const id = String(request.params.id);
    const body = objectBody(request);
    const pool = db.prepare("SELECT * FROM split_pools WHERE id=? AND host_user_id=?").get(id, userId);
    if (!pool) return sendError(response, 404, "Pool not found");

    if (body && typeof body.fallback_enabled === "boolean") {
      db.prepare("UPDATE split_pools SET fallback_enabled=? WHERE id=?").run(Number(body.fallback_enabled), id);
    } else if (body && typeof body.member_id === "string") {
      if (!config.demoEnabled) return sendError(response, 403, "Connect a payment provider for contributions");
      try {
        transaction(db, () => {
          const member = db.prepare("SELECT * FROM pool_members WHERE id=? AND pool_id=?").get(body.member_id as string, id);
          if (!member || member.payment_status === "PAID")
            throw new HttpError(409, "Contribution is already paid or member was not found");
          // Only the host's own share debits the host wallet; friends' shares are simulated.
          settleContribution(db, { ...member, user_id: member.user_id === userId ? userId : null }, pool.currency, "Insufficient wallet balance");
        });
      } catch (error) {
        return sendFailure(response, error, "Could not settle contribution");
      }
    } else {
      return sendError(response, 400, "Invalid pool update");
    }
    response.json(dashboardFor(context, userId));
  });

  return router;
}
