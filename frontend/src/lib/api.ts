import { supabase } from './supabase';

export interface Profile { id: string; display_name: string; created_at: string; updated_at: string }

export async function profileRequest(method: 'GET' | 'PATCH' = 'GET', displayName?: string): Promise<Profile> {
  if (!supabase) throw new Error('Authentication is unavailable.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Please sign in again.');
  const response = await fetch(`${(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')}/profile`, {
    method,
    headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
    ...(method === 'PATCH' ? { body: JSON.stringify({ display_name: displayName }) } : {}),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Unable to load your profile.');
  return body.profile;
}
