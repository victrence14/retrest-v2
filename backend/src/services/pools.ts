import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const poolMemberInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(200),
  share_amount: z.number().int().positive(),
});

export const createPoolSchema = z.object({
  subscription_id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  target_amount: z.number().int().positive(),
  currency: z.enum(['NGN', 'USD']),
  fallback_enabled: z.boolean().optional(),
  members: z.array(poolMemberInputSchema).min(1).max(20),
  invite_expires_in_days: z.number().int().min(1).max(30).optional(),
}).strict();

export const updatePoolSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  target_amount: z.number().int().positive().optional(),
  currency: z.enum(['NGN', 'USD']).optional(),
  fallback_enabled: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'PAID']).optional(),
  invite_revoked: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required.' });

export const contributionSchema = z.object({
  amount_minor: z.number().int().positive(),
  currency: z.enum(['NGN', 'USD']),
  reference: z.string().trim().min(1).max(120),
}).strict();

export type CreatePoolInput = z.infer<typeof createPoolSchema>;
export type UpdatePoolInput = z.infer<typeof updatePoolSchema>;
export type ContributionInput = z.infer<typeof contributionSchema>;

export const poolSelect = 'id, subscription_id, host_user_id, name, pool_balance, target_amount, currency, status, fallback_enabled, invite_token, invite_expires_at, invite_revoked_at, created_at, updated_at';
export const memberSelect = 'id, pool_id, user_id, name, email, share_amount, payment_status, auto_debit_scheduled, created_at, updated_at';
export const contributionSelect = 'id, pool_id, member_id, user_id, amount_minor, currency, status, reference, created_at, settled_at';

export type PoolRecord = Record<string, unknown>;
export type MemberRecord = Record<string, unknown>;
export type ContributionRecord = Record<string, unknown>;

export async function listPools(db: SupabaseClient, userId: string): Promise<PoolRecord[]> {
  const hosted = await db.from('split_pools').select(poolSelect).eq('host_user_id', userId).order('created_at', { ascending: false });
  const memberships = await db.from('pool_members').select('pool_id').eq('user_id', userId);
  const memberPoolIds = ((memberships.data ?? []) as Array<{ pool_id: string }>).map((row) => row.pool_id);
  const shared = memberPoolIds.length > 0
    ? await db.from('split_pools').select(poolSelect).in('id', memberPoolIds)
    : { data: [] as unknown[] };
  const byId = new Map<string, PoolRecord>();
  for (const pool of [...(hosted.data ?? []), ...(shared.data ?? [])] as PoolRecord[]) {
    if (typeof pool.id === 'string') { byId.set(pool.id, pool); }
  }
  return [...byId.values()];
}

export async function createPool(db: SupabaseClient, userId: string, input: CreatePoolInput) {
  const subscription = await db.from('subscriptions').select('id, currency, amount_minor').eq('id', input.subscription_id).eq('user_id', userId).single();
  if (!subscription.data) { return { status: 'not_found' as const }; }
  const existing = await db.from('split_pools').select('id').eq('subscription_id', input.subscription_id).maybeSingle();
  if (existing.data) { return { status: 'conflict' as const }; }
  const shareTotal = input.members.reduce((total, member) => total + member.share_amount, 0);
  if (shareTotal !== input.target_amount) { return { status: 'invalid_shares' as const }; }
  const emails = input.members.map((member) => member.email.toLowerCase());
  if (new Set(emails).size !== emails.length) { return { status: 'invalid_members' as const }; }
  const expiresAt = new Date(Date.now() + (input.invite_expires_in_days ?? 14) * 86_400_000).toISOString();
  const pool = await db.from('split_pools').insert({
    subscription_id: input.subscription_id,
    host_user_id: userId,
    name: input.name,
    target_amount: input.target_amount,
    currency: input.currency,
    fallback_enabled: input.fallback_enabled ?? true,
    invite_token: randomUUID(),
    invite_expires_at: expiresAt,
  }).select(poolSelect).single();
  if (!pool.data) { return { status: 'error' as const }; }
  const members = await db.from('pool_members').insert(input.members.map((member) => ({
    pool_id: (pool.data as PoolRecord).id,
    name: member.name,
    email: member.email.toLowerCase(),
    share_amount: member.share_amount,
  }))).select(memberSelect);
  return { status: 'created' as const, pool: pool.data as PoolRecord, members: (members.data ?? []) as MemberRecord[] };
}

export async function getPool(db: SupabaseClient, userId: string, poolId: string) {
  const pool = await db.from('split_pools').select(poolSelect).eq('id', poolId).maybeSingle();
  if (!pool.data) { return null; }
  const record = pool.data as PoolRecord;
  if (record.host_user_id !== userId) {
    const membership = await db.from('pool_members').select('id').eq('pool_id', poolId).eq('user_id', userId).maybeSingle();
    if (!membership.data) { return null; }
  }
  const members = await db.from('pool_members').select(memberSelect).eq('pool_id', poolId).order('created_at', { ascending: true });
  return { pool: record, members: (members.data ?? []) as MemberRecord[] };
}

export async function updatePool(db: SupabaseClient, userId: string, poolId: string, input: UpdatePoolInput) {
  const existing = await db.from('split_pools').select('id').eq('id', poolId).eq('host_user_id', userId).single();
  if (!existing.data) { return { status: 'not_found' as const }; }
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) { updates.name = input.name; }
  if (input.target_amount !== undefined) { updates.target_amount = input.target_amount; }
  if (input.currency !== undefined) { updates.currency = input.currency; }
  if (input.fallback_enabled !== undefined) { updates.fallback_enabled = input.fallback_enabled; }
  if (input.status !== undefined) { updates.status = input.status; }
  if (input.invite_revoked === true) { updates.invite_revoked_at = new Date().toISOString(); }
  if (input.invite_revoked === false) { updates.invite_revoked_at = null; }
  const pool = await db.from('split_pools').update(updates).eq('id', poolId).eq('host_user_id', userId).select(poolSelect).single();
  if (!pool.data) { return { status: 'error' as const }; }
  return { status: 'updated' as const, pool: pool.data as PoolRecord };
}

export async function listContributions(db: SupabaseClient, userId: string, poolId: string) {
  const pool = await getPool(db, userId, poolId);
  if (!pool) { return null; }
  const rows = await db.from('pool_contributions').select(contributionSelect).eq('pool_id', poolId).order('created_at', { ascending: false });
  return (rows.data ?? []) as ContributionRecord[];
}

export async function createContribution(db: SupabaseClient, userId: string, poolId: string, input: ContributionInput) {
  const pool = await getPool(db, userId, poolId);
  if (!pool) { return { status: 'not_found' as const }; }
  const replay = await db.from('pool_contributions').select(contributionSelect).eq('pool_id', poolId).eq('reference', input.reference).maybeSingle();
  if (replay.data) { return { status: 'replayed' as const, contribution: replay.data as ContributionRecord }; }
  const member = await db.from('pool_members').select('id').eq('pool_id', poolId).eq('user_id', userId).maybeSingle();
  const contribution = await db.from('pool_contributions').insert({
    pool_id: poolId,
    member_id: member.data?.id ?? null,
    user_id: userId,
    amount_minor: input.amount_minor,
    currency: input.currency,
    status: 'SETTLED',
    reference: input.reference,
    settled_at: new Date().toISOString(),
  }).select(contributionSelect).single();
  if (!contribution.data) {
    // A concurrent retry can win the unique (pool_id, reference) constraint.
    const retry = await db.from('pool_contributions').select(contributionSelect).eq('pool_id', poolId).eq('reference', input.reference).maybeSingle();
    if (retry.data) { return { status: 'replayed' as const, contribution: retry.data as ContributionRecord }; }
    return { status: 'error' as const };
  }
  const nextBalance = Number(pool.pool.pool_balance ?? 0) + input.amount_minor;
  await db.from('split_pools').update({
    pool_balance: nextBalance,
    status: nextBalance >= Number(pool.pool.target_amount ?? 0) ? 'PAID' : 'ACTIVE',
  }).eq('id', poolId);
  if (member.data?.id) {
    await db.from('pool_members').update({ payment_status: 'PAID' }).eq('id', member.data.id);
  }
  return { status: 'created' as const, contribution: contribution.data as ContributionRecord };
}

export async function getContribution(db: SupabaseClient, userId: string, poolId: string, contributionId: string) {
  const pool = await getPool(db, userId, poolId);
  if (!pool) { return null; }
  const row = await db.from('pool_contributions').select(contributionSelect).eq('id', contributionId).eq('pool_id', poolId).maybeSingle();
  return (row.data ?? null) as ContributionRecord | null;
}

export interface InviteView {
  pool_id: string;
  name: string;
  target_amount: number;
  currency: string;
  status: string;
  expires_at: string | null;
  revoked_at: string | null;
  valid: boolean;
  expired: boolean;
  revoked: boolean;
}

export async function getInvite(db: SupabaseClient, token: string): Promise<InviteView | null> {
  const result = await db.rpc('pool_invite', { p_token: token });
  const rows = Array.isArray(result.data) ? result.data : [];
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) { return null; }
  const expiresAt = row.expires_at ? String(row.expires_at) : null;
  const revokedAt = row.revoked_at ? String(row.revoked_at) : null;
  const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
  const revoked = Boolean(revokedAt);
  return {
    pool_id: String(row.pool_id),
    name: String(row.name),
    target_amount: Number(row.target_amount),
    currency: String(row.currency),
    status: String(row.status),
    expires_at: expiresAt,
    revoked_at: revokedAt,
    valid: !expired && !revoked,
    expired,
    revoked,
  };
}

export async function acceptInvite(db: SupabaseClient, token: string) {
  const result = await db.rpc('accept_pool_invite', { p_token: token });
  if (result.error) {
    const message = result.error.message ?? '';
    if (message.includes('invite_not_found')) { return { status: 'not_found' as const }; }
    if (message.includes('invite_revoked')) { return { status: 'revoked' as const }; }
    if (message.includes('invite_expired')) { return { status: 'expired' as const }; }
    if (message.includes('invite_email_mismatch')) { return { status: 'email_mismatch' as const }; }
    if (message.includes('invite_already_claimed')) { return { status: 'claimed' as const }; }
    return { status: 'error' as const };
  }
  const rows = Array.isArray(result.data) ? result.data : [];
  return { status: 'accepted' as const, membership: (rows[0] ?? null) as Record<string, unknown> | null };
}
