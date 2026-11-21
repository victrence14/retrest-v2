import { Router } from 'express';
import { authContext } from '../middleware/auth.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', async (request, response) => {
  const { user, db } = authContext(response);
  const notifications = await db.from('notifications').select(
    'id, user_id, subscription_id, transaction_id, title, message, read_at, created_at',
  ).eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
  response.json({ notifications });
});

notificationsRouter.post('/:id/read', async (request, response) => {
  const { id } = request.params;
  const { user, db } = authContext(response);
  const notification = await db.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id).select(
    'id, user_id, subscription_id, transaction_id, title, message, read_at, created_at',
  ).single();
  if (!notification?.data) { response.status(404).json({ error: 'Notification not found.' }); return; }
  response.json({ notification: notification.data });
});
