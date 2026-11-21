import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { authorize, validateAuthorization } from "@/lib/authorization";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.CARD_WEBHOOK_SECRET;
  if (!secret)
    return Response.json(
      { error: "Issuer webhook secret is not configured" },
      { status: 503 },
    );
  const raw = await request.text();
  if (raw.length > 8192)
    return Response.json({ error: "Payload too large" }, { status: 413 });
  const timestamp = request.headers.get("x-retrest-timestamp") ?? "";
  const signature = request.headers.get("x-retrest-signature") ?? "";
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${raw}`)
    .digest("hex");
  if (
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    !timingSafeEqual(
      Buffer.from(signature.toLowerCase()),
      Buffer.from(expected),
    )
  )
    return Response.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!validateAuthorization(payload))
    return Response.json(
      {
        error:
          "Invalid authorization payload; amounts must be positive integer minor units",
      },
      { status: 400 },
    );
  const started = performance.now();
  try {
    const result = authorize(getDb(), payload);
    return Response.json(result.body, {
      status: result.status,
      headers: {
        "Server-Timing": `auth;dur=${(performance.now() - started).toFixed(2)}`,
        "X-Idempotent-Replay": String(!!result.replayed),
      },
    });
  } catch {
    return Response.json(
      { decision: "DECLINE", reason: "Authorization temporarily unavailable" },
      { status: 503 },
    );
  }
}
