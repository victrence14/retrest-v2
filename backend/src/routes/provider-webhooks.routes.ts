import { createHash } from "node:crypto";
import express, { Router } from "express";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "../config.ts";
import { databaseResult } from "../lib/database-result.ts";
import { currency, id, minorAmount, parse, timestamp } from "../lib/feature-validation.ts";
import { HttpError } from "../lib/http.ts";
import { verifyResendSignature, verifyTimestampedHmac } from "../lib/signatures.ts";

const eventId = z.string().min(1).max(200);
const payment = z.object({
  provider_event_id: eventId, provider_transaction_id: eventId,
  user_id: id, subscription_id: id.nullable().default(null),
  merchant_name: z.string().trim().min(1).max(100), amount_minor: minorAmount, currency,
  status: z.enum(["PENDING", "SETTLED", "DECLINED", "REVERSED"]),
  is_business_expense: z.boolean(),
  fx_ngn_amount: z.number().int().min(0).max(1_000_000_000_000).default(0),
  pool_amount: z.number().int().min(0).max(1_000_000_000_000).default(0),
  decline_reason: z.string().max(250).nullable().default(null), created_at: timestamp.optional(),
}).strict().refine(value => value.pool_amount <= value.amount_minor, { path: ["pool_amount"] });
function json(raw: Buffer): unknown {
  try { return JSON.parse(raw.toString("utf8")); } catch { throw new HttpError(400, "Invalid JSON."); }
}
export function providerWebhookRoutes(config: Config, admin: SupabaseClient | null) {
  const router = Router();
  const rawBody = express.raw({ type: () => true, limit: "32kb" });
  for (const path of ["/settlements", "/contributions"]) {
    router.post(path, rawBody, async (request, response) => {
      if (!admin || !config.settlementWebhookSecret) throw new HttpError(503, "Settlement transport is not configured.");
      const raw = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      if (!verifyTimestampedHmac(raw, request.get("x-retrest-timestamp") ?? "", request.get("x-retrest-signature") ?? "", config.settlementWebhookSecret))
        throw new HttpError(401, "Invalid settlement signature.");
      const value = json(raw);
      let result: { replayed?: boolean };
      if (path === "/settlements") {
        const { provider_event_id, ...payload } = parse(payment, value);
        result = databaseResult(await admin.rpc("record_payment_event", { p_event_id: provider_event_id, p_payload: payload }));
      } else {
        const input = parse(z.object({
          provider_event_id: eventId, contribution_id: id, status: z.enum(["SETTLED", "FAILED"]), amount_minor: minorAmount, currency,
        }).strict(), value);
        result = databaseResult(await admin.rpc("record_contribution_event", {
          p_event_id: input.provider_event_id, p_contribution_id: input.contribution_id, p_status: input.status,
          p_amount_minor: input.amount_minor, p_currency: input.currency,
        }));
      }
      response.set("X-Idempotent-Replay", String(!!result.replayed)).json(result);
    });
  }
  router.post("/email", rawBody, async (request, response) => {
    if (!admin || !config.email?.webhookSecret) throw new HttpError(503, "Email delivery webhooks are not configured.");
    const raw = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    const event = request.get("svix-id") ?? "";
    if (!verifyResendSignature(raw, event, request.get("svix-timestamp") ?? "", request.get("svix-signature") ?? "", config.email.webhookSecret))
      throw new HttpError(401, "Invalid email webhook signature.");
    const input = parse(z.object({ type: z.string().min(1).max(80) }).passthrough(), json(raw));
    const statuses = new Map([
      ["email.delivered", "DELIVERED"], ["email.bounced", "BOUNCED"], ["email.failed", "FAILED"],
    ]);
    const status = statuses.get(input.type);
    if (!status) return response.json({ ok: true, ignored: true });
    const data = parse(z.object({ email_id: eventId }).passthrough(), input.data);
    databaseResult(await admin.rpc("record_email_event", {
      p_event_id: event, p_provider_message_id: data.email_id, p_status: status,
      p_payload_hash: createHash("sha256").update(raw).digest("hex"),
    }));
    response.json({ ok: true });
  });
  return router;
}
