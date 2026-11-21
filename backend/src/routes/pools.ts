import { Router } from 'express';
import { authContext } from '../middleware/auth.js';
import {
  contributionSchema,
  createContribution,
  createPool,
  createPoolSchema,
  getContribution,
  getPool,
  listContributions,
  listPools,
  updatePool,
  updatePoolSchema,
} from '../services/pools.js';

export function createPoolsRouter() {
  const poolsRouter = Router();

  poolsRouter.get('/', async (request, response) => {
    const { user, db } = authContext(response);
    const pools = await listPools(db, user.id);
    response.json({ pools });
  });

  poolsRouter.post('/', async (request, response) => {
    const parsed = createPoolSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'Invalid pool payload.' }); return; }
    const { user, db } = authContext(response);
    const result = await createPool(db, user.id, parsed.data);
    if (result.status === 'not_found') { response.status(404).json({ error: 'Subscription not found.' }); return; }
    if (result.status === 'conflict') { response.status(409).json({ error: 'A pool already exists for this subscription.' }); return; }
    if (result.status === 'invalid_shares') { response.status(400).json({ error: 'Member shares must equal the pool target amount.' }); return; }
    if (result.status === 'invalid_members') { response.status(400).json({ error: 'Member emails must be unique.' }); return; }
    if (result.status === 'error') { response.status(500).json({ error: 'Unable to create the pool.' }); return; }
    response.status(201).json({ pool: result.pool, members: result.members });
  });

  poolsRouter.get('/:id', async (request, response) => {
    const { id } = request.params;
    const { user, db } = authContext(response);
    const pool = await getPool(db, user.id, id);
    if (!pool) { response.status(404).json({ error: 'Pool not found.' }); return; }
    response.json(pool);
  });

  poolsRouter.patch('/:id', async (request, response) => {
    const { id } = request.params;
    const parsed = updatePoolSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'Invalid pool update payload.' }); return; }
    const { user, db } = authContext(response);
    const result = await updatePool(db, user.id, id, parsed.data);
    if (result.status === 'not_found') { response.status(404).json({ error: 'Pool not found.' }); return; }
    if (result.status === 'error') { response.status(500).json({ error: 'Unable to update the pool.' }); return; }
    response.json({ pool: result.pool });
  });

  poolsRouter.get('/:id/contributions', async (request, response) => {
    const { id } = request.params;
    const { user, db } = authContext(response);
    const contributions = await listContributions(db, user.id, id);
    if (!contributions) { response.status(404).json({ error: 'Pool not found.' }); return; }
    response.json({ contributions });
  });

  poolsRouter.post('/:id/contributions', async (request, response) => {
    const { id } = request.params;
    const parsed = contributionSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'Invalid contribution payload.' }); return; }
    const { user, db } = authContext(response);
    const result = await createContribution(db, user.id, id, parsed.data);
    if (result.status === 'not_found') { response.status(404).json({ error: 'Pool not found.' }); return; }
    if (result.status === 'error') { response.status(500).json({ error: 'Unable to record the contribution.' }); return; }
    const replayed = result.status === 'replayed';
    response.status(replayed ? 200 : 201).json({ contribution: result.contribution, replayed });
  });

  poolsRouter.get('/:id/contributions/:contributionId', async (request, response) => {
    const { id, contributionId } = request.params;
    const { user, db } = authContext(response);
    const contribution = await getContribution(db, user.id, id, contributionId);
    if (!contribution) { response.status(404).json({ error: 'Contribution not found.' }); return; }
    response.json({ contribution });
  });

  return poolsRouter;
}
