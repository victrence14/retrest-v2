import { Router } from "express";
import { z } from "zod";
import type { SubscriptionRecord } from "../../contracts/features.ts";
import { authContext } from "../../middleware/supabase-auth.ts";
import { databaseResult } from "../../lib/database-result.ts";
import { booleanQuery, currency, id, listQuery, parse, subscriptionInput, subscriptionPatch } from "../../lib/feature-validation.ts";
import { listRecords } from "../../services/feature-store.ts";

const columns = "id,user_id,name,merchant_descriptor,category_slug,amount_minor,expected_max_amount,currency,active,billing_cycle,next_billing_date,is_business_expense,needs_review,created_at,updated_at";
export function subscriptionFeatureRoutes() {
  const router = Router();
  router.get("/categories", async (_request, response) => {
    response.json({ data: databaseResult(await authContext(response).db.from("subscription_categories").select("slug,label").order("slug")) });
  });
  router.get("/", async (request, response) => {
    const input = parse(listQuery.extend({ active: booleanQuery.optional(), business: booleanQuery.optional(), currency: currency.optional() }), request.query);
    const { db, user } = authContext(response);
    const filters: Record<string, string | boolean> = { user_id: user.id };
    if (input.active !== undefined) filters.active = input.active;
    if (input.business !== undefined) filters.is_business_expense = input.business;
    if (input.currency) filters.currency = input.currency;
    response.json(await listRecords<SubscriptionRecord>(db, user.id, "subscriptions", columns, input, filters));
  });
  router.post("/", async (request, response) => {
    const input = parse(subscriptionInput, request.body);
    const { db, user } = authContext(response);
    const data = databaseResult(await db.from("subscriptions").insert({
      ...input, user_id: user.id, expected_max_amount: input.expected_max_amount ?? input.amount_minor,
    }).select(columns).single());
    response.status(201).json({ subscription: data });
  });
  router.patch("/:id", async (request, response) => {
    const subscriptionId = parse(id, request.params.id);
    const input = parse(subscriptionPatch, request.body);
    const { db, user } = authContext(response);
    response.json({ subscription: databaseResult(await db.from("subscriptions").update(input)
      .eq("id", subscriptionId).eq("user_id", user.id).select(columns).single()) });
  });
  return router;
}
