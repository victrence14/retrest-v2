import { Router } from 'express';
import { z } from 'zod';
import { authContext } from '../middleware/auth.js';
import { buildInsights } from '../services/insights.js';
import { deliverSummaryEmail } from '../jobs/summaryEmail.js';

const summaryRequest = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).strict();
const summarySelect = 'id, user_id, month, totals, highlights, review_flags, email_status, email_sent_at, created_at, updated_at';

export const spendSummariesRouter = Router();

spendSummariesRouter.post('/', async (request, response) => {
  const parsed = summaryRequest.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ error: 'Send month=YYYY-MM.' }); return; }
  const { user, db } = authContext(response);
  const insights = await buildInsights(db, user.id, parsed.data.month);
  const summary = await db.from('spend_summaries').upsert({
    user_id: user.id,
    month: parsed.data.month,
    totals: insights.totals,
    highlights: insights.top_merchants,
    review_flags: insights.review_flags,
    email_status: 'NOT_SENT',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,month' }).select(summarySelect).single();
  if (!summary.data) { response.status(500).json({ error: 'Unable to build the spend summary.' }); return; }
  response.status(201).json({ summary: summary.data });
});

spendSummariesRouter.post('/:id/email', async (request, response) => {
  const { id } = request.params;
  const { user, db } = authContext(response);
  const result = await deliverSummaryEmail(db, user.id, id);
  if (result.status === 'not_found') { response.status(404).json({ error: 'Summary not found.' }); return; }
  response.json({ summary: result.summary });
});
