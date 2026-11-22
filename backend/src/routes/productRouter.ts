import { Router } from 'express';
import { authContext } from '../middleware/auth.js';
import { listSubscriptionCategories } from '../services/subscriptions.js';
import { subscriptionsRouter } from './subscriptions.js';
import { createPoolsRouter } from './pools.js';
import { poolSchedulesRouter } from './poolSchedules.js';
import { invitesRouter } from './invites.js';
import { insightsRouter } from './insights.js';
import { spendSummariesRouter } from './spendSummaries.js';
import { supportRouter } from './support.js';
import { transactionsRouter } from './transactions.js';
import { receiptsRouter } from './receipts.js';
import { exportsRouter } from './exports.js';
import { devicesRouter } from './devices.js';
import { notificationsRouter } from './notifications.js';
import { settingsRouter } from './settings.js';

// Single product-domain mount point. BE1 mounts this after its auth middleware;
// the only public product route (invite preview) is mounted separately.
export function createProductRouter() {
  const productRouter = Router();

  productRouter.use('/subscriptions', subscriptionsRouter);
  productRouter.get('/subscription-categories', async (request, response) => {
    const { db } = authContext(response);
    const categories = await listSubscriptionCategories(db);
    response.json({ categories });
  });

  productRouter.use('/pools', createPoolsRouter());
  productRouter.use('/pools', poolSchedulesRouter);
  productRouter.use('/invites', invitesRouter);
  productRouter.use('/insights', insightsRouter);
  productRouter.use('/spend-summaries', spendSummariesRouter);
  productRouter.use('/support', supportRouter);
  productRouter.use('/transactions', transactionsRouter);
  productRouter.use('/receipts', receiptsRouter);
  productRouter.use('/export', exportsRouter);
  productRouter.use('/devices', devicesRouter);
  productRouter.use('/notifications', notificationsRouter);
  productRouter.use('/settings', settingsRouter);

  return productRouter;
}
