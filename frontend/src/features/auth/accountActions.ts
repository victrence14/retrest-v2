import { supabase } from '../../lib/supabase';

function authClient() {
  if (!supabase) throw new Error('Authentication is unavailable.');
  return supabase;
}

export async function sendPasswordRecovery(email: string, redirectTo: string): Promise<void> {
  const { error } = await authClient().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function resendSignupConfirmation(email: string): Promise<void> {
  const { error } = await authClient().auth.resend({ type: 'signup', email });
  if (error) throw error;
}

export async function updateAccountPassword(password: string): Promise<void> {
  const { error } = await authClient().auth.updateUser({ password });
  if (error) throw error;
}

export async function requestEmailChange(email: string, redirectTo: string): Promise<void> {
  const { error } = await authClient().auth.updateUser({ email }, { emailRedirectTo: redirectTo });
  if (error) throw error;
}
