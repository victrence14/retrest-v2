import { Router } from 'express';
import { authContext } from '../middleware/auth.js';
import { transactionSelect } from './transactions.js';
import { csvEscape, totalsByCurrency, transactionsToCsv } from '../services/documents.js';
import { PRODUCT_CONFIG } from '../product-config.js';

export const exportsRouter = Router();

exportsRouter.get('/', async (request, response) => {
  const month = typeof request.query.month === 'string' && /^\d{4}-\d{2}$/.test(request.query.month) ? request.query.month : null;
  if (!month) { response.status(400).json({ error: 'Send month=YYYY-MM.' }); return; }
  const format = request.query.format === 'csv' ? 'csv' : 'json';
  const { user, db } = authContext(response);
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const rows = await db.from('transactions').select(transactionSelect)
    .eq('user_id', user.id)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: true })
    .limit(PRODUCT_CONFIG.exportMaxRows);
  const transactions = (rows.data ?? []) as Array<Record<string, unknown>>;
  const totals = totalsByCurrency(transactions);
  if (format === 'csv') {
    response.type('text/csv');
    response.set('Content-Disposition', `attachment; filename="retrest-${month}.csv"`);
    response.send(transactionsToCsv(transactions));
    return;
  }
  response.json({ month, totals, transactions });
});
