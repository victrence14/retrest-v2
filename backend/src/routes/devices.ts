import { Router } from 'express';
import { z } from 'zod';
import { authContext } from '../middleware/auth.js';
import { createDeviceChallenge, deleteDevice, listDevices, verifyDevice } from '../services/deviceVerification.js';

const challengeRequest = z.object({
  device_name: z.string().trim().min(1).max(80),
}).strict();

const verifyRequest = z.object({
  device_id: z.uuid(),
  code: z.string().regex(/^\d{6}$/),
}).strict();

export const devicesRouter = Router();

devicesRouter.get('/', async (request, response) => {
  const { user, db } = authContext(response);
  const devices = await listDevices(db, user.id);
  response.json({ devices });
});

devicesRouter.post('/challenges', async (request, response) => {
  const parsed = challengeRequest.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ error: 'Send a valid device_name.' }); return; }
  const { user, db } = authContext(response);
  const result = await createDeviceChallenge(db, user.id, parsed.data.device_name);
  if (result.status === 'error') { response.status(500).json({ error: 'Unable to create a device challenge.' }); return; }
  response.status(201).json({
    device: result.device,
    challenge_code: result.challenge_code,
    expires_at: result.expires_at,
    delivery: 'Returned for the demo; production sends this code over the verified channel.',
  });
});

devicesRouter.post('/verify', async (request, response) => {
  const parsed = verifyRequest.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ error: 'Send a valid device_id and 6-digit code.' }); return; }
  const { user, db } = authContext(response);
  const result = await verifyDevice(db, user.id, parsed.data.device_id, parsed.data.code);
  switch (result.status) {
    case 'not_found': response.status(404).json({ error: 'Device not found.' }); return;
    case 'already_verified': response.status(409).json({ error: 'Device is already verified.' }); return;
    case 'expired': response.status(410).json({ error: 'Challenge expired. Start a new one.' }); return;
    case 'too_many_attempts': response.status(429).json({ error: 'Too many attempts. Start a new challenge.' }); return;
    case 'invalid_code': response.status(400).json({ error: 'Invalid verification code.' }); return;
    case 'error': response.status(500).json({ error: 'Unable to verify the device.' }); return;
    default: response.json({ device: result.device });
  }
});

devicesRouter.delete('/:id', async (request, response) => {
  const { id } = request.params;
  const { user, db } = authContext(response);
  const deleted = await deleteDevice(db, user.id, id);
  if (!deleted) { response.status(404).json({ error: 'Device not found.' }); return; }
  response.json({ deleted: true });
});
