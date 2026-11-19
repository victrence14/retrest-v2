import { dashboard, getDb, demoEnabled } from "@/lib/db";
import { requireUser, jsonBody } from "@/lib/api";

export async function POST(request: Request) {
  const auth = await requireUser(request, true);
  if (auth.error) return auth.error;
  if (!demoEnabled()) return Response.json({ error: "Connect a payment provider to fund your wallet" }, { status: 403 });
  const body = await jsonBody(request);
  if (!body || (body.currency !== "NGN" && body.currency !== "USD") || !Number.isSafeInteger(body.amount) || Number(body.amount) <= 0 || Number(body.amount) > 100000000) return Response.json({ error: "Enter a valid amount" }, { status: 400 });
  const column = body.currency === "USD" ? "usd_balance" : "ngn_balance";
  getDb().prepare(`UPDATE users SET ${column}=${column}+? WHERE id=?`).run(Number(body.amount), auth.userId);
  return Response.json(dashboard(auth.userId));
}
