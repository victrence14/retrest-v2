import { Router } from 'express';
import { authContext } from '../middleware/auth.js';
import { buildInsights } from '../services/insights.js';

export const insightsRouter = Router();

insightsRouter.get('/', async (request, response) => {
  const month = typeof request.query.month === 'string' && /^\d{4}-\d{2}$/.test(request.query.month) ? request.query.month : null;
  if (!month) { response.status(400).json({ error: 'Send month=YYYY-MM.' }); return; }
  const { user, db } = authContext(response);
  const insights = await buildInsights(db, user.id, month);
  response.json(insights);
});
