import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const merchantDescriptorSchema = z.string().regex(/^[A-Z0-9 _.-]{2,60}$/);

export const createSubscriptionSchema = z.object({
  merchant_name: z.string().trim().min(1).max(80),
  merchant_descriptor: z.string().regex(/^[A-Z0-9 _.-]{2,60}$/),
  category_slug: z.string().optional(),
  expected_amount_minor: z.number().int().positive(),
  max_amount_minor: z.number().int().positive().optional(),
  currency: z.enum(['NGN', 'USD']),
  billing_cycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
  next_billing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_business_expense: z.boolean().optional(),
  plan_name: z.string().max(80).optional(),
}).strict();

export const updateSubscriptionSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  max_amount_minor: z.number().int().positive().optional(),
  next_billing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  is_business_expense: z.boolean().optional(),
  plan_name: z.string().max(80).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required.' });

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

export const subscriptionSelect = 'id, user_id, name, category_slug, amount_minor, currency, active, merchant_name, merchant_descriptor, max_amount_minor, billing_cycle, next_billing_date, is_business_expense, needs_review, plan_name, created_at, updated_at';

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  name: string;
  category_slug: string | null;
  amount_minor: number;
  currency: 'NGN' | 'USD';
  active: boolean;
  merchant_name: string;
  merchant_descriptor: string;
  max_amount_minor: number;
  billing_cycle: 'MONTHLY' | 'YEARLY';
  next_billing_date: string;
  is_business_expense: boolean;
  needs_review: boolean;
  plan_name: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionMutationResult {
  status: 'created' | 'conflict';
  subscription: SubscriptionRecord | null;
}

export async function listSubscriptions(db: SupabaseClient, userId: string): Promise<SubscriptionRecord[]> {
  const rows = await db.from('subscriptions').select(subscriptionSelect).eq('user_id', userId).order('next_billing_date', { ascending: true });
  const data = (rows.data ?? []) as unknown as SubscriptionRecord[];
  return data.filter((subscription) => Boolean(subscription?.id));
}

export async function createSubscription(db: SupabaseClient, userId: string, input: CreateSubscriptionInput): Promise<SubscriptionMutationResult> {
  const duplicate = await db.from('subscriptions').select('id').eq('user_id', userId).eq('merchant_descriptor', input.merchant_descriptor).maybeSingle();
  if (duplicate.data) { return { status: 'conflict', subscription: null }; }
  const subscription = await db.from('subscriptions').insert({
    user_id: userId,
    name: input.merchant_name,
    category_slug: input.category_slug ?? null,
    amount_minor: input.expected_amount_minor,
    currency: input.currency,
    merchant_name: input.merchant_name,
    merchant_descriptor: input.merchant_descriptor,
    max_amount_minor: input.max_amount_minor ?? input.expected_amount_minor,
    billing_cycle: input.billing_cycle ?? 'MONTHLY',
    next_billing_date: new Date(`${input.next_billing_date}T00:00:00Z`).toISOString(),
    is_business_expense: input.is_business_expense ?? false,
    plan_name: input.plan_name ?? 'Monthly subscription',
  }).select(subscriptionSelect).single();
  const record = (subscription.data ?? null) as SubscriptionRecord | null;
  if (!record) {
    // A concurrent retry can win the unique (user_id, merchant_descriptor) index.
    const retry = await db.from('subscriptions').select('id').eq('user_id', userId).eq('merchant_descriptor', input.merchant_descriptor).maybeSingle();
    if (retry.data) { return { status: 'conflict', subscription: null }; }
  }
  return { status: 'created', subscription: record };
}

export async function getSubscription(db: SupabaseClient, userId: string, id: string): Promise<SubscriptionRecord | null> {
  const subscription = await db.from('subscriptions').select(subscriptionSelect).eq('id', id).eq('user_id', userId).single();
  return (subscription.data ?? null) as SubscriptionRecord | null;
}

export async function updateSubscription(db: SupabaseClient, userId: string, id: string, input: UpdateSubscriptionInput): Promise<SubscriptionRecord | null> {
  const updates: Record<string, unknown> = {};
  if (input.status) updates.status = input.status;
  if (input.max_amount_minor !== undefined) updates.max_amount_minor = input.max_amount_minor;
  if (input.next_billing_date) updates.next_billing_date = new Date(`${input.next_billing_date}T00:00:00Z`).toISOString();
  if (input.is_business_expense !== undefined) updates.is_business_expense = input.is_business_expense;
  if (input.plan_name !== undefined) updates.plan_name = input.plan_name;
  const subscription = await db.from('subscriptions').update(updates).eq('id', id).eq('user_id', userId).select(subscriptionSelect).single();
  return (subscription.data ?? null) as SubscriptionRecord | null;
}

export async function deleteSubscription(db: SupabaseClient, userId: string, id: string): Promise<boolean> {
  const existing = await db.from('subscriptions').select('id').eq('id', id).eq('user_id', userId).single();
  if (!existing.data) { return false; }
  await db.from('subscriptions').delete().eq('id', id);
  return true;
}

export async function listSubscriptionCategories(db: SupabaseClient): Promise<Array<{ slug: string; label: string }>> {
  const rows = await db.from('subscription_categories').select('slug, label').order('slug', { ascending: true });
  return (rows.data ?? []) as Array<{ slug: string; label: string }>;
}
