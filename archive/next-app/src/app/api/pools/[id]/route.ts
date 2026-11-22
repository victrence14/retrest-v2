import { dashboard, getDb, demoEnabled } from "@/lib/db";
import { requireUser, jsonBody } from "@/lib/api";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request, true);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const body = await jsonBody(request);
  const db = getDb();
  const pool = db
    .prepare("SELECT * FROM split_pools WHERE id=? AND host_user_id=?")
    .get(id, auth.userId);
  if (!pool) return Response.json({ error: "Pool not found" }, { status: 404 });
  if (body && typeof body.fallback_enabled === "boolean")
    db.prepare("UPDATE split_pools SET fallback_enabled=? WHERE id=?").run(
      Number(body.fallback_enabled),
      id,
    );
  else if (body && typeof body.member_id === "string") {
    if (!demoEnabled())
      return Response.json(
        { error: "Connect a payment provider for contributions" },
        { status: 403 },
      );
    db.exec("BEGIN IMMEDIATE");
    try {
      const member = db
        .prepare("SELECT * FROM pool_members WHERE id=? AND pool_id=?")
        .get(body.member_id, id);
      if (!member || member.payment_status === "PAID") {
        db.exec("ROLLBACK");
        return Response.json(
          { error: "Contribution is already paid or member was not found" },
          { status: 409 },
        );
      }
      if (member.user_id === auth.userId) {
        const column = pool.currency === "USD" ? "usd_balance" : "ngn_balance";
        const result = db
          .prepare(
            `UPDATE users SET ${column}=${column}-? WHERE id=? AND ${column}>=?`,
          )
          .run(
            Number(member.share_amount),
            auth.userId,
            Number(member.share_amount),
          );
        if (!result.changes) {
          db.exec("ROLLBACK");
          return Response.json(
            { error: "Insufficient wallet balance" },
            { status: 400 },
          );
        }
      }
      db.prepare(
        "UPDATE pool_members SET payment_status='PAID',auto_debit_scheduled=0 WHERE id=?",
      ).run(member.id);
      db.prepare(
        "UPDATE split_pools SET pool_balance=pool_balance+?,status='ACTIVE' WHERE id=?",
      ).run(Number(member.share_amount), id);
      db.exec("COMMIT");
    } catch {
      db.exec("ROLLBACK");
      return Response.json(
        { error: "Could not settle contribution" },
        { status: 500 },
      );
    }
  } else
    return Response.json({ error: "Invalid pool update" }, { status: 400 });
  return Response.json(dashboard(auth.userId));
}
