import { Router } from 'express';
import { z } from 'zod';
import { authContext } from '../middleware/auth.js';

const createThread = z.object({
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(4000),
  subscription_id: z.uuid().optional(),
  transaction_id: z.uuid().optional(),
}).strict();

const messageInput = z.object({ message: z.string().trim().min(1).max(4000) }).strict();

const threadSelect = 'id, user_id, subject, subscription_id, transaction_id, status, created_at, updated_at';
const messageSelect = 'id, thread_id, sender_id, body, created_at';

export const supportRouter = Router();

supportRouter.get('/threads', async (request, response) => {
  const { user, db } = authContext(response);
  const threads = await db.from('support_threads').select(threadSelect).eq('user_id', user.id).order('updated_at', { ascending: false });
  response.json({ threads: threads.data ?? [] });
});

supportRouter.post('/threads', async (request, response) => {
  const parsed = createThread.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ error: 'Send a valid subject and message.' }); return; }
  const { user, db } = authContext(response);
  const thread = await db.from('support_threads').insert({
    user_id: user.id,
    subject: parsed.data.subject,
    subscription_id: parsed.data.subscription_id ?? null,
    transaction_id: parsed.data.transaction_id ?? null,
  }).select(threadSelect).single();
  if (!thread.data) { response.status(500).json({ error: 'Unable to create the support thread.' }); return; }
  await db.from('support_messages').insert({ thread_id: thread.data.id, sender_id: user.id, body: parsed.data.message });
  response.status(201).json({ thread: thread.data });
});

supportRouter.get('/threads/:id/messages', async (request, response) => {
  const { id } = request.params;
  const { user, db } = authContext(response);
  const thread = await db.from('support_threads').select('id').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!thread.data) { response.status(404).json({ error: 'Support thread not found.' }); return; }
  const messages = await db.from('support_messages').select(messageSelect).eq('thread_id', id).order('created_at', { ascending: true });
  response.json({ messages: messages.data ?? [] });
});

supportRouter.post('/threads/:id/messages', async (request, response) => {
  const { id } = request.params;
  const parsed = messageInput.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ error: 'Send a valid message.' }); return; }
  const { user, db } = authContext(response);
  const thread = await db.from('support_threads').select('id').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!thread.data) { response.status(404).json({ error: 'Support thread not found.' }); return; }
  const message = await db.from('support_messages').insert({ thread_id: id, sender_id: user.id, body: parsed.data.message }).select(messageSelect).single();
  response.status(201).json({ message: message.data });
});
