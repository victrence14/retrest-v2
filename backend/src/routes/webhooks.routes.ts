import { createHmac, timingSafeEqual } from "node:crypto";
import express, { Router } from "express";
import type { AppContext } from "../context.ts";
import { sendError } from "../lib/http.ts";
import { authorize, validateAuthorization } from "../services/authorization.ts";

const MAX_PAYLOAD_LENGTH = 8192;
const SIGNATURE_TOLERANCE_SECONDS = 300;

/** Card-issuer authorization webhook, authenticated by an HMAC over `${timestamp}.${raw body}`. */
export function webhookRoutes({ db, config }: AppContext) {
  const router = Router();
  // The signature covers the exact bytes, so this route reads the raw body itself.
  router.use(express.text({ type: () => true, limit: "16kb" }));

  router.post("/card-auth", (request, response) => {
    const secret = config.webhookSecret;
    if (!secret) return sendError(response, 503, "Issuer webhook secret is not configured");
    const raw = typeof request.body === "string" ? request.body : "";
    if (raw.length > MAX_PAYLOAD_LENGTH) return sendError(response, 413, "Payload too large");

    const timestamp = request.get("x-retrest-timestamp") ?? "";
    const signature = request.get("x-retrest-signature") ?? "";
    const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
    if (
      !/^\d+$/.test(timestamp) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS ||
      !/^[a-f0-9]{64}$/i.test(signature) ||
      !timingSafeEqual(Buffer.from(signature.toLowerCase()), Buffer.from(expected))
    )
      return sendError(response, 401, "Invalid webhook signature");

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return sendError(response, 400, "Invalid JSON");
    }
    if (!validateAuthorization(payload))
      return sendError(response, 400, "Invalid authorization payload; amounts must be positive integer minor units");

    const started = performance.now();
    try {
      const result = authorize(db, payload);
      response
        .status(result.status)
        .set({
          "Server-Timing": `auth;dur=${(performance.now() - started).toFixed(2)}`,
          "X-Idempotent-Replay": String(!!result.replayed),
        })
        .json(result.body);
    } catch {
      response.status(503).json({ decision: "DECLINE", reason: "Authorization temporarily unavailable" });
    }
  });

  return router;
}
