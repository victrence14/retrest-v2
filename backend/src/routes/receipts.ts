import { Router } from 'express';
import { authContext } from '../middleware/auth.js';
import { buildReceipt } from '../services/documents.js';

export const receiptsRouter = Router();

receiptsRouter.get('/:id', async (request, response) => {
  const { id } = request.params;
  const { user, db } = authContext(response);
  const receipt = await buildReceipt(db, user.id, id);
  if (!receipt) { response.status(404).json({ error: 'Receipt not found.' }); return; }
  response.json({ receipt });
});
