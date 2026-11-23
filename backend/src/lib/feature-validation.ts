import { z } from "zod";
import { HttpError } from "./http.ts";

export const id = z.uuid();
export const currency = z.enum(["NGN", "USD"]);
export const minorAmount = z.number().int().min(1).max(1_000_000_000_000);
export const month = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
export const booleanQuery = z.enum(["true", "false"]).transform(value => value === "true");
export const timestamp = z.iso.datetime({ offset: true }).transform(value => new Date(value).toISOString());
export const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(2048).optional(),
}).strict();

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map(issue => issue.path.join(".") || "body"))];
    throw new HttpError(400, `Invalid ${fields.join(", ")}.`);
  }
  return result.data;
}

export const idempotencyKey = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);
export function requestKey(value: unknown): string { return parse(idempotencyKey, value); }

export function monthRange(value: string): { from: string; to: string } {
  parse(month, value);
  const [year, number] = value.split("-").map(Number);
  return {
    from: new Date(Date.UTC(year, number - 1, 1)).toISOString(),
    to: new Date(Date.UTC(year, number, 1)).toISOString(),
  };
}

export const transactionQuery = listQuery.extend({
  month: month.optional(), from: timestamp.optional(), to: timestamp.optional(),
  currency: currency.optional(),
  status: z.enum(["PENDING", "SETTLED", "DECLINED", "REVERSED"]).optional(),
  business: booleanQuery.optional(),
  subscription_id: id.optional(),
}).refine(value => !(value.month && (value.from || value.to)), {
  message: "Use month or from/to.", path: ["month"],
}).refine(value => !value.from || !value.to || value.from < value.to, {
  message: "from must precede to.", path: ["to"],
});
export type TransactionQuery = z.infer<typeof transactionQuery>;
export function transactionRange(query: Pick<TransactionQuery, "month" | "from" | "to">) {
  return query.month ? monthRange(query.month) : { from: query.from, to: query.to };
}

const subscriptionFields = z.object({
  name: z.string().trim().min(1).max(80),
  merchant_descriptor: z.string().trim().min(1).max(100).transform(value => value.toUpperCase()),
  category_slug: z.string().regex(/^[a-z0-9-]{1,50}$/).nullable().optional(),
  amount_minor: minorAmount, expected_max_amount: minorAmount.optional(),
  currency, active: z.boolean(),
  billing_cycle: z.enum(["MONTHLY", "YEARLY"]),
  next_billing_date: z.iso.date(),
  is_business_expense: z.boolean(),
}).strict();
export const subscriptionInput = subscriptionFields.extend({
  active: z.boolean().default(true), billing_cycle: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  is_business_expense: z.boolean().default(false),
}).refine(value => (value.expected_max_amount ?? value.amount_minor) >= value.amount_minor, {
  path: ["expected_max_amount"], message: "The maximum must cover the expected amount.",
});
export const subscriptionPatch = subscriptionFields.partial().refine(value => Object.keys(value).length > 0)
  .refine(value => value.expected_max_amount === undefined || value.amount_minor === undefined || value.expected_max_amount >= value.amount_minor, {
    path: ["expected_max_amount"], message: "The maximum must cover the expected amount.",
  });
export const memberInput = z.object({
  display_name: z.string().trim().min(1).max(80),
  email: z.email().trim().max(254).transform(value => value.toLowerCase()),
  share_amount: minorAmount,
}).strict();
export const poolInput = z.object({
  subscription_id: id, name: z.string().trim().min(1).max(80),
  members: z.array(memberInput).min(2).max(20),
  fallback_enabled: z.boolean().default(true),
}).strict().refine(value => new Set(value.members.map(member => member.email)).size === value.members.length, {
  path: ["members"], message: "Member emails must be unique.",
});
export const poolPatch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  fallback_enabled: z.boolean().optional(), status: z.enum(["ACTIVE", "CLOSED"]).optional(),
}).strict().refine(value => Object.keys(value).length > 0);

const timeZone = z.string().max(64).refine(value => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}, "Use an IANA time zone.");
export const settingsPatch = z.object({
  auto_fx_enabled: z.boolean().optional(),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/).nullable().optional(),
  theme: z.enum(["system", "light", "dark"]).optional(), time_zone: timeZone.optional(),
  email_notifications: z.boolean().optional(), monthly_summary_email: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0);
