import { Router } from 'express';
import { z } from 'zod';
import { authContext } from '../middleware/auth.js';

const profilePatch = z.object({ display_name: z.string().trim().max(80) }).strict();
export const profileRouter = Router();

profileRouter.get('/', async (_request, response) => {
  const { user, db } = authContext(response);
  const { data, error } = await db.from('profiles').select('id, display_name, created_at, updated_at').eq('id', user.id).single();
  if (error) { response.status(503).json({ error: 'Unable to load your profile. Check that the database migration has been applied.' }); return; }
  response.json({ profile: data });
});

profileRouter.patch('/', async (request, response) => {
  const parsed = profilePatch.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ error: 'Send only display_name, a string of at most 80 characters.' }); return; }
  const { user, db } = authContext(response);
  const { data, error } = await db.from('profiles').update(parsed.data).eq('id', user.id).select('id, display_name, created_at, updated_at').single();
  if (error) { response.status(503).json({ error: 'Unable to save your profile. Please try again.' }); return; }
  response.json({ profile: data });
});
