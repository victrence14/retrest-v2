import { Router } from 'express';
import { authContext } from '../middleware/auth.js';
import {
  createSubscription,
  createSubscriptionSchema,
  deleteSubscription,
  getSubscription,
  listSubscriptions,
  updateSubscription,
  updateSubscriptionSchema,
} from '../services/subscriptions.js';

export const subscriptionsRouter = Router();

subscriptionsRouter.get('/', async (request, response) => {
  const { user, db } = authContext(response);
  const subscriptions = await listSubscriptions(db, user.id);
  response.json({ subscriptions });
});

subscriptionsRouter.post('/', async (request, response) => {
  const parsed = createSubscriptionSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ error: 'Invalid merchant subscription payload.' }); return; }
  const { user, db } = authContext(response);
  const result = await createSubscription(db, user.id, parsed.data);
  if (result.status === 'conflict') { response.status(409).json({ error: 'A subscription for this merchant descriptor already exists.' }); return; }
  response.status(201).json({ subscription: result.subscription });
});

subscriptionsRouter.get('/:id', async (request, response) => {
  const { id } = request.params;
  const { user, db } = authContext(response);
  const subscription = await getSubscription(db, user.id, id);
  if (!subscription) { response.status(404).json({ error: 'Subscription not found.' }); return; }
  response.json({ subscription });
});

subscriptionsRouter.patch('/:id', async (request, response) => {
  const { id } = request.params;
  const parsed = updateSubscriptionSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ error: 'Invalid merchant rule payload.' }); return; }
  const { user, db } = authContext(response);
  const subscription = await updateSubscription(db, user.id, id, parsed.data);
  if (!subscription) { response.status(404).json({ error: 'Subscription not found.' }); return; }
  response.json({ subscription });
});

subscriptionsRouter.delete('/:id', async (request, response) => {
  const { id } = request.params;
  const { user, db } = authContext(response);
  const deleted = await deleteSubscription(db, user.id, id);
  if (!deleted) { response.status(404).json({ error: 'Subscription not found.' }); return; }
  response.json({ deleted: true });
});
