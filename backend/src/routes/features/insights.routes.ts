import { Router } from "express";
import { z } from "zod";
import type { Config } from "../../config.ts";
import type { MonthlySummaryRecord } from "../../contracts/features.ts";
import { authContext } from "../../middleware/supabase-auth.ts";
import { databaseResult } from "../../lib/database-result.ts";
import { booleanQuery, id, listQuery, month, monthRange, parse, requestKey, timestamp } from "../../lib/feature-validation.ts";
import { HttpError } from "../../lib/http.ts";
import { listRecords } from "../../services/feature-store.ts";
import { periodSummary } from "../../services/transactions.ts";

const summaryColumns = "id,user_id,month,totals,created_at";
export function insightFeatureRoutes(config: Config) {
  const router = Router();
  router.get("/insights/summary", async (request, response) => {
    const input = parse(z.object({
      month: month.optional(), from: timestamp.optional(), to: timestamp.optional(), business: booleanQuery.optional(),
    }).strict().refine(value => !(value.month && (value.from || value.to)))
      .refine(value => (!value.from && !value.to) || (!!value.from && !!value.to && value.from < value.to)), request.query);
    const period = input.from && input.to ? { from: input.from, to: input.to } : monthRange(input.month ?? new Date().toISOString().slice(0, 7));
    response.json(await periodSummary(authContext(response).db, period.from, period.to, input.business));
  });
  router.get("/summaries", async (request, response) => {
    const { db, user } = authContext(response);
    response.json(await listRecords<MonthlySummaryRecord>(db, user.id, "monthly_summaries", summaryColumns, parse(listQuery, request.query), { user_id: user.id }));
  });
  router.post("/summaries", async (request, response) => {
    const input = parse(z.object({ month }).strict(), request.body);
    response.status(201).json({ summary: databaseResult(await authContext(response).db.rpc("generate_monthly_summary", { p_month: input.month })) });
  });
  router.get("/summaries/:id", async (request, response) => {
    const summaryId = parse(id, request.params.id);
    const { db, user } = authContext(response);
    response.json({ summary: databaseResult(await db.from("monthly_summaries").select(summaryColumns).eq("id", summaryId).eq("user_id", user.id).single()) });
  });
  router.post("/summaries/:id/email", async (request, response) => {
    const summaryId = parse(id, request.params.id);
    parse(z.object({}).strict(), request.body ?? {});
    if (!config.email) throw new HttpError(503, "Monthly email delivery is not configured.");
    response.status(202).json({ job: databaseResult(await authContext(response).db.rpc("queue_summary_email", {
      p_summary_id: summaryId, p_idempotency_key: requestKey(request.get("idempotency-key")),
    })) });
  });
  router.get("/email-jobs/:id", async (request, response) => {
    const jobId = parse(id, request.params.id);
    const { db, user } = authContext(response);
    response.json({ job: databaseResult(await db.from("email_jobs").select("id,summary_id,status,attempts,created_at,updated_at")
      .eq("id", jobId).eq("user_id", user.id).single()) });
  });
  return router;
}
