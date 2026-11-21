import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getInvite } from '../services/pools.js';

export function createPublicInvitesRouter(db: SupabaseClient) {
  const publicInvitesRouter = Router();

  publicInvitesRouter.get('/:token', async (request, response) => {
    const { token } = request.params;
    const invite = await getInvite(db, token);
    if (!invite) { response.status(404).json({ error: 'Invitation not found.' }); return; }
    response.json({ invite });
  });

  return publicInvitesRouter;
}
