import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { PoolRecord } from "../../contracts/features.ts";
import { authContext } from "../../middleware/supabase-auth.ts";
import { databaseResult } from "../../lib/database-result.ts";
import { id, listQuery, parse, poolInput, poolPatch, requestKey } from "../../lib/feature-validation.ts";
import { listRecords } from "../../services/feature-store.ts";

const poolColumns = "id,host_user_id,subscription_id,name,target_amount,currency,balance_minor,fallback_enabled,status,created_at,updated_at";
const memberColumns = "id,pool_id,user_id,display_name,invited_email,share_amount,payment_status,accepted_at";
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function poolFeatureRoutes() {
  const router = Router();
  router.get("/pools", async (request, response) => {
    const { db, user } = authContext(response);
    response.json(await listRecords<PoolRecord>(db, user.id, "pools", poolColumns, parse(listQuery, request.query)));
  });
  router.post("/pools", async (request, response) => {
    const input = parse(poolInput, request.body);
    response.status(201).json(databaseResult(await authContext(response).db.rpc("create_pool", {
      p_subscription_id: input.subscription_id, p_name: input.name, p_members: input.members, p_fallback_enabled: input.fallback_enabled,
    })));
  });
  router.get("/pools/:id", async (request, response) => {
    const poolId = parse(id, request.params.id);
    const { db } = authContext(response);
    const pool = databaseResult(await db.from("pools").select(poolColumns).eq("id", poolId).single());
    const members = databaseResult(await db.from("pool_members").select(memberColumns).eq("pool_id", poolId).order("id"));
    response.json({ pool, members });
  });
  router.patch("/pools/:id", async (request, response) => {
    const poolId = parse(id, request.params.id);
    const input = parse(poolPatch, request.body);
    const { db, user } = authContext(response);
    response.json({ pool: databaseResult(await db.from("pools").update(input)
      .eq("id", poolId).eq("host_user_id", user.id).select(poolColumns).single()) });
  });
  router.post("/pools/:id/invites", async (request, response) => {
    const poolId = parse(id, request.params.id);
    const input = parse(z.object({ member_id: id, expires_in_days: z.number().int().min(1).max(30).default(7) }).strict(), request.body);
    const token = randomBytes(32).toString("base64url");
    const invite = databaseResult(await authContext(response).db.rpc("create_pool_invite", {
      p_pool_id: poolId, p_member_id: input.member_id, p_token_hash: hashToken(token),
      p_expires_at: new Date(Date.now() + input.expires_in_days * 86_400_000).toISOString(),
    }));
    response.status(201).json({ invite, token, path: `/invite/${token}` });
  });
  router.get("/invites/:token", async (request, response) => {
    const token = parse(tokenSchema, request.params.token);
    response.json(databaseResult(await authContext(response).db.rpc("get_pool_invite", { p_token_hash: hashToken(token) })));
  });
  router.post("/invites/:token/accept", async (request, response) => {
    const token = parse(tokenSchema, request.params.token);
    parse(z.object({}).strict(), request.body ?? {});
    response.json(databaseResult(await authContext(response).db.rpc("accept_pool_invite", { p_token_hash: hashToken(token) })));
  });
  router.delete("/invites/:id", async (request, response) => {
    const inviteId = parse(id, request.params.id);
    databaseResult(await authContext(response).db.rpc("revoke_pool_invite", { p_invite_id: inviteId }));
    response.json({ ok: true });
  });
  router.post("/pools/:id/contributions", async (request, response) => {
    const poolId = parse(id, request.params.id);
    parse(z.object({}).strict(), request.body ?? {});
    response.status(202).json(databaseResult(await authContext(response).db.rpc("initiate_pool_contribution", {
      p_pool_id: poolId, p_idempotency_key: requestKey(request.get("idempotency-key")),
    })));
  });
  router.get("/contributions/:id", async (request, response) => {
    const contributionId = parse(id, request.params.id);
    response.json({ contribution: databaseResult(await authContext(response).db.from("pool_contributions")
      .select("id,pool_id,member_id,user_id,amount_minor,currency,status,created_at,settled_at").eq("id", contributionId).single()) });
  });
  return router;
}
