import { Router } from 'express';
import { authContext } from '../middleware/auth.js';

export const transactionSelect = 'id, authorization_id, user_id, subscription_id, merchant_name, amount_minor, currency, status, decline_reason, receipt_url, fx_ngn_amount, pool_amount, http_status, response_json, created_at';

export const transactionsRouter = Router();

transactionsRouter.get('/', async (request, response) => {
  const { user, db } = authContext(response);
  const limit = Math.min(Math.max(Number(request.query.limit ?? 20), 1), 100);
  const offset = Math.max(Number(request.query.offset ?? 0), 0);
  let query = db.from('transactions').select(transactionSelect).eq('user_id', user.id);
  if (typeof request.query.month === 'string' && /^\d{4}-\d{2}$/.test(request.query.month)) {
    const start = new Date(`${request.query.month}-01T00:00:00Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
  }
  if (typeof request.query.status === 'string' && request.query.status.length > 0) { query = query.eq('status', request.query.status); }
  if (typeof request.query.currency === 'string' && request.query.currency.length > 0) { query = query.eq('currency', request.query.currency); }
  if (typeof request.query.merchant === 'string' && request.query.merchant.length > 0) { query = query.ilike('merchant_name', `%${request.query.merchant}%`); }
  const transactions = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  response.json({ transactions: transactions.data ?? [], pagination: { limit, offset } });
});

transactionsRouter.get('/:id', async (request, response) => {
  const { id } = request.params;
  const { user, db } = authContext(response);
  const transaction = await db.from('transactions').select(transactionSelect).eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!transaction.data) { response.status(404).json({ error: 'Transaction not found.' }); return; }
  response.json({ transaction: transaction.data });
});
