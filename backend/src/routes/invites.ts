import { Router } from 'express';
import { authContext } from '../middleware/auth.js';
import { acceptInvite } from '../services/pools.js';

export const invitesRouter = Router();

invitesRouter.post('/:token/accept', async (request, response) => {
  const { token } = request.params;
  const { db } = authContext(response);
  const result = await acceptInvite(db, token);
  switch (result.status) {
    case 'not_found': response.status(404).json({ error: 'Invitation not found.' }); return;
    case 'revoked': response.status(410).json({ error: 'Invitation was revoked.' }); return;
    case 'expired': response.status(410).json({ error: 'Invitation has expired.' }); return;
    case 'email_mismatch': response.status(403).json({ error: 'Sign in with the invited email address to accept.' }); return;
    case 'claimed': response.status(409).json({ error: 'Invitation was already accepted.' }); return;
    case 'error': response.status(500).json({ error: 'Unable to accept the invitation.' }); return;
    default: response.json({ membership: result.membership });
  }
});
