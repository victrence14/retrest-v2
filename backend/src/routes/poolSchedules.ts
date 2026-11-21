import { Router } from 'express';
import { z } from 'zod';
import { authContext } from '../middleware/auth.js';

const scheduleInput = z.object({
  amount_minor: z.number().int().positive(),
  currency: z.enum(['NGN', 'USD']).optional(),
  next_run_at: z.string().datetime().optional(),
}).strict();

const scheduleUpdate = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']).optional(),
  amount_minor: z.number().int().positive().optional(),
  next_run_at: z.string().datetime().optional(),
}).strict();

const scheduleSelect = 'id, pool_id, user_id, amount_minor, currency, cadence, next_run_at, consent_at, status, created_at, updated_at';

export const poolSchedulesRouter = Router();

poolSchedulesRouter.get('/:id/schedule', async (request, response) => {
  const { id } = request.params;
  const { user, db } = authContext(response);
  const schedule = await db.from('pool_schedules').select(scheduleSelect).eq('pool_id', id).eq('user_id', user.id).maybeSingle();
  if (!schedule.data) { response.status(404).json({ error: 'Schedule not found.' }); return; }
  response.json({ schedule: schedule.data });
});

poolSchedulesRouter.post('/:id/schedule', async (request, response) => {
  const { id } = request.params;
  const parsed = scheduleInput.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ error: 'Invalid schedule payload.' }); return; }
  const { user, db } = authContext(response);
  const membership = await db.from('pool_members').select('id').eq('pool_id', id).eq('user_id', user.id).maybeSingle();
  const hosted = membership.data ? null : await db.from('split_pools').select('id').eq('id', id).eq('host_user_id', user.id).maybeSingle();
  if (!membership.data && !hosted?.data) { response.status(403).json({ error: 'Only pool members can schedule contributions.' }); return; }
  const now = new Date().toISOString();
  const schedule = await db.from('pool_schedules').upsert({
    pool_id: id,
    user_id: user.id,
    amount_minor: parsed.data.amount_minor,
    currency: parsed.data.currency ?? 'NGN',
    next_run_at: parsed.data.next_run_at ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
    consent_at: now,
    status: 'ACTIVE',
    updated_at: now,
  }, { onConflict: 'pool_id,user_id' }).select(scheduleSelect).single();
  if (!schedule.data) { response.status(500).json({ error: 'Unable to save the schedule.' }); return; }
  response.status(201).json({ schedule: schedule.data });
});

poolSchedulesRouter.patch('/:id/schedule', async (request, response) => {
  const { id } = request.params;
  const parsed = scheduleUpdate.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ error: 'Invalid schedule update payload.' }); return; }
  const { user, db } = authContext(response);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.status !== undefined) { updates.status = parsed.data.status; }
  if (parsed.data.amount_minor !== undefined) { updates.amount_minor = parsed.data.amount_minor; }
  if (parsed.data.next_run_at !== undefined) { updates.next_run_at = parsed.data.next_run_at; }
  const schedule = await db.from('pool_schedules').update(updates).eq('pool_id', id).eq('user_id', user.id).select(scheduleSelect).single();
  if (!schedule.data) { response.status(404).json({ error: 'Schedule not found.' }); return; }
  response.json({ schedule: schedule.data });
});
