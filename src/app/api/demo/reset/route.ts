import { dashboard, getDb, seedDatabase, demoEnabled } from "@/lib/db";
import { requireUser } from "@/lib/api";

export async function POST(request: Request) {
  const auth = await requireUser(request, true);
  if (auth.error) return auth.error;
  if (!demoEnabled()) return Response.json({ error: "Demo reset disabled" }, { status: 403 });
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM notifications WHERE user_id=?").run(auth.userId);
    db.prepare("DELETE FROM transaction_logs WHERE user_id=?").run(auth.userId);
    db.prepare("DELETE FROM pool_members WHERE pool_id IN (SELECT id FROM split_pools WHERE host_user_id=?)").run(auth.userId);
    db.prepare("DELETE FROM split_pools WHERE host_user_id=?").run(auth.userId);
    db.prepare("DELETE FROM merchant_rules WHERE user_id=?").run(auth.userId);
    db.prepare("DELETE FROM merchant_subscriptions WHERE user_id=?").run(auth.userId);
    db.prepare("DELETE FROM virtual_cards WHERE user_id=?").run(auth.userId);
    db.prepare("DELETE FROM users WHERE id=?").run(auth.userId);
    db.exec("COMMIT");
    seedDatabase(db);
    return Response.json(dashboard(auth.userId));
  } catch { try { db.exec("ROLLBACK"); } catch {} return Response.json({ error: "Could not reset demo" }, { status: 500 }); }
}
