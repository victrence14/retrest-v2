import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { DeviceRecord } from "../../contracts/features.ts";
import { authContext } from "../../middleware/supabase-auth.ts";
import { databaseResult } from "../../lib/database-result.ts";
import { booleanQuery, id, listQuery, parse, settingsPatch } from "../../lib/feature-validation.ts";
import { listRecords } from "../../services/feature-store.ts";

const settingsColumns = "user_id,auto_fx_enabled,phone,theme,time_zone,email_notifications,monthly_summary_email,updated_at";
const deviceColumns = "id,name,created_at,last_used_at,expires_at,revoked_at";
const notificationColumns = "id,title,message,resource_type,resource_id,read_at,created_at";
export function accountFeatureRoutes() {
  const router = Router();
  router.get("/me", (_request, response) => {
    const { user } = authContext(response);
    response.json({ user: { id: user.id, email: user.email, email_verified: true } });
  });
  router.get("/profile", async (_request, response) => {
    const { db, user } = authContext(response);
    response.json({ profile: databaseResult(await db.from("profiles").select("id,display_name,created_at,updated_at").eq("id", user.id).single()) });
  });
  router.patch("/profile", async (request, response) => {
    const input = parse(z.object({ display_name: z.string().trim().min(1).max(80) }).strict(), request.body);
    const { db, user } = authContext(response);
    response.json({ profile: databaseResult(await db.from("profiles").update(input).eq("id", user.id).select("id,display_name,created_at,updated_at").single()) });
  });
  router.get("/settings", async (_request, response) => {
    const { db, user } = authContext(response);
    response.json({ settings: databaseResult(await db.from("user_settings").select(settingsColumns).eq("user_id", user.id).single()) });
  });
  router.patch("/settings", async (request, response) => {
    const input = parse(settingsPatch, request.body);
    const { db, user } = authContext(response);
    response.json({ settings: databaseResult(await db.from("user_settings").update(input).eq("user_id", user.id).select(settingsColumns).single()) });
  });
  router.get("/devices", async (request, response) => {
    const { db, user } = authContext(response);
    response.json(await listRecords<DeviceRecord>(db, user.id, "devices", deviceColumns, parse(listQuery, request.query), { user_id: user.id }));
  });
  router.post("/devices", async (request, response) => {
    const input = parse(z.object({ name: z.string().trim().min(1).max(80) }).strict(), request.body);
    const token = randomBytes(32).toString("base64url");
    const device = databaseResult(await authContext(response).db.rpc("register_device", {
      p_name: input.name, p_token_hash: createHash("sha256").update(token).digest("hex"),
      p_expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    }));
    response.status(201).json({ device, trust_token: token });
  });
  router.delete("/devices/:id", async (request, response) => {
    const deviceId = parse(id, request.params.id);
    response.json({ device: databaseResult(await authContext(response).db.rpc("revoke_device", { p_device_id: deviceId })) });
  });
  router.get("/notifications", async (request, response) => {
    const input = parse(listQuery.extend({ unread: booleanQuery.optional() }), request.query);
    const { db, user } = authContext(response);
    const filters: Record<string, string | null> = { user_id: user.id };
    if (input.unread === true) filters.read_at = null;
    const [records, countResult] = await Promise.all([
      listRecords<{ id: string; created_at: string }>(db, user.id, "account_notifications", notificationColumns, input, filters),
      db.from("account_notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
    ]);
    databaseResult({ data: countResult.count ?? 0, error: countResult.error });
    response.json({ ...records, unread_count: countResult.count ?? 0 });
  });
  router.patch("/notifications/read", async (request, response) => {
    const input = parse(z.union([
      z.object({ ids: z.array(id).min(1).max(100) }).strict(), z.object({ all: z.literal(true) }).strict(),
    ]), request.body);
    response.json({ updated: databaseResult(await authContext(response).db.rpc("mark_notifications_read", { p_ids: "ids" in input ? input.ids : null })) });
  });
  return router;
}
