import { randomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PRODUCT_CONFIG } from '../product-config.js';

export const deviceSelect = 'id, user_id, device_name, challenge_expires_at, attempts, verified_at, revoked_at, created_at, updated_at';

export interface DeviceRecord {
  id: string;
  user_id: string;
  device_name: string;
  challenge_expires_at: string | null;
  attempts: number;
  verified_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listDevices(db: SupabaseClient, userId: string): Promise<DeviceRecord[]> {
  const rows = await db.from('user_devices').select(deviceSelect).eq('user_id', userId).order('created_at', { ascending: false });
  return (rows.data ?? []) as DeviceRecord[];
}

export async function createDeviceChallenge(db: SupabaseClient, userId: string, deviceName: string) {
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + PRODUCT_CONFIG.deviceChallengeTtlMs).toISOString();
  const device = await db.from('user_devices').insert({
    user_id: userId,
    device_name: deviceName,
    challenge_token: code,
    challenge_expires_at: expiresAt,
    attempts: 0,
  }).select(deviceSelect).single();
  if (!device.data) { return { status: 'error' as const }; }
  return {
    status: 'created' as const,
    device: device.data as DeviceRecord,
    challenge_code: code,
    expires_at: expiresAt,
  };
}

export async function verifyDevice(db: SupabaseClient, userId: string, deviceId: string, code: string) {
  const device = await db.from('user_devices').select('id, challenge_token, challenge_expires_at, attempts, verified_at').eq('id', deviceId).eq('user_id', userId).single();
  if (!device.data) { return { status: 'not_found' as const }; }
  const row = device.data as { id: string; challenge_token: string; challenge_expires_at: string | null; attempts: number; verified_at: string | null };
  if (row.verified_at) { return { status: 'already_verified' as const }; }
  if (!row.challenge_expires_at || new Date(row.challenge_expires_at).getTime() < Date.now()) { return { status: 'expired' as const }; }
  if (row.attempts >= PRODUCT_CONFIG.deviceChallengeMaxAttempts) { return { status: 'too_many_attempts' as const }; }
  if (row.challenge_token !== code) {
    await db.from('user_devices').update({ attempts: row.attempts + 1 }).eq('id', deviceId);
    return { status: 'invalid_code' as const };
  }
  const verified = await db.from('user_devices').update({
    verified_at: new Date().toISOString(),
    challenge_token: '',
  }).eq('id', deviceId).eq('user_id', userId).select(deviceSelect).single();
  if (!verified.data) { return { status: 'error' as const }; }
  return { status: 'verified' as const, device: verified.data as DeviceRecord };
}

export async function deleteDevice(db: SupabaseClient, userId: string, deviceId: string) {
  const existing = await db.from('user_devices').select('id').eq('id', deviceId).eq('user_id', userId).single();
  if (!existing.data) { return false; }
  await db.from('user_devices').delete().eq('id', deviceId).eq('user_id', userId);
  return true;
}
