import { Router } from "express";
import { z } from "zod";
import type { Config } from "../../config.ts";
import type { SupportMessageRecord, SupportThreadRecord } from "../../contracts/features.ts";
import { authContext } from "../../middleware/supabase-auth.ts";
import { databaseResult } from "../../lib/database-result.ts";
import { id, listQuery, parse, requestKey } from "../../lib/feature-validation.ts";
import { HttpError } from "../../lib/http.ts";
import type { RateLimitStore } from "../../middleware/rate-limit.ts";
import { listRecords } from "../../services/feature-store.ts";

const threadColumns = "id,user_id,subject,status,created_at,updated_at";
const messageColumns = "id,thread_id,sender_role,body,created_at";
const body = z.string().trim().min(1).max(4000);
export function supportFeatureRoutes(config: Config, limits: RateLimitStore) {
  const router = Router();
  router.get("/availability", (_request, response) => response.json({
    transport: "database_inbox", accepting_messages: config.supportEnabled !== false, response_mode: "asynchronous",
  }));
  router.use(async (request, response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
    if (config.supportEnabled === false && request.method === "POST") throw new HttpError(503, "Support is not accepting new messages.");
    const limit = await limits.consume(`support:${authContext(response).user.id}`, 30, 60_000);
    if (!limit.allowed) {
      response.set("Retry-After", String(limit.retryAfterSeconds));
      throw new HttpError(429, "Too many support messages. Try again later.");
    }
    next();
  });
  router.get("/threads", async (request, response) => {
    const input = parse(listQuery.extend({ status: z.enum(["OPEN", "CLOSED"]).optional() }), request.query);
    const { db, user } = authContext(response);
    response.json(await listRecords<SupportThreadRecord>(db, user.id, "support_threads", threadColumns, input, {
      user_id: user.id, ...(input.status ? { status: input.status } : {}),
    }));
  });
  router.get("/inbox", async (request, response) => {
    const input = parse(listQuery.extend({ status: z.enum(["OPEN", "CLOSED"]).optional() }), request.query);
    const { db, user } = authContext(response);
    if (!databaseResult<boolean>(await db.rpc("is_support_agent"))) throw new HttpError(403, "Support staff access required.");
    response.json(await listRecords<SupportThreadRecord>(db, user.id, "support_threads", threadColumns, input, input.status ? { status: input.status } : {}));
  });
  router.post("/threads", async (request, response) => {
    const input = parse(z.object({ subject: z.string().trim().min(1).max(160), body }).strict(), request.body);
    response.status(201).json(databaseResult(await authContext(response).db.rpc("create_support_thread", {
      p_subject: input.subject, p_body: input.body, p_idempotency_key: requestKey(request.get("idempotency-key")),
    })));
  });
  router.get("/threads/:id", async (request, response) => {
    const threadId = parse(id, request.params.id);
    response.json({ thread: databaseResult(await authContext(response).db.from("support_threads").select(threadColumns).eq("id", threadId).single()) });
  });
  router.patch("/threads/:id", async (request, response) => {
    const threadId = parse(id, request.params.id);
    const input = parse(z.object({ status: z.enum(["OPEN", "CLOSED"]) }).strict(), request.body);
    response.json({ thread: databaseResult(await authContext(response).db.rpc("set_support_thread_status", { p_thread_id: threadId, p_status: input.status })) });
  });
  router.get("/threads/:id/messages", async (request, response) => {
    const threadId = parse(id, request.params.id);
    const input = parse(listQuery, request.query);
    const { db, user } = authContext(response);
    databaseResult(await db.from("support_threads").select("id").eq("id", threadId).single());
    response.json(await listRecords<SupportMessageRecord>(db, user.id, "support_messages", messageColumns, input, { thread_id: threadId }));
  });
  router.post("/threads/:id/messages", async (request, response) => {
    const threadId = parse(id, request.params.id);
    const input = parse(z.object({ body }).strict(), request.body);
    response.status(201).json(databaseResult(await authContext(response).db.rpc("add_support_message", {
      p_thread_id: threadId, p_body: input.body, p_idempotency_key: requestKey(request.get("idempotency-key")),
    })));
  });
  return router;
}
