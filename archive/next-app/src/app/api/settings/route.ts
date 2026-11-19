import { dashboard, getDb } from "@/lib/db";
import { requireUser, jsonBody } from "@/lib/api";

export async function PATCH(request: Request) {
  const auth = await requireUser(request, true);
  if (auth.error) return auth.error;
  const body = await jsonBody(request);
  if (!body || typeof body.auto_fx_enabled !== "boolean") return Response.json({ error: "Invalid setting" }, { status: 400 });
  getDb().prepare("UPDATE users SET auto_fx_enabled=? WHERE id=?").run(Number(body.auto_fx_enabled), auth.userId);
  return Response.json(dashboard(auth.userId));
}
