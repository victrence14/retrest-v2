import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { AuthCard } from './AuthCard';

export function AuthForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const credentials = { email: String(form.get('email')), password: String(form.get('password')) };
    setBusy(true); setError(''); setMessage('');
    try {
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: `${window.location.origin}/`, data: { display_name: String(form.get('name') || '') } } });
      if (result.error) throw result.error;
      if (mode === 'signup' && !result.data.session) setMessage('Check your email to confirm your account, then sign in.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.'); }
    finally { setBusy(false); }
  }

  return <AuthCard mode={mode} busy={busy} configured={Boolean(supabase)} error={error} message={message} onSubmit={submit}
    onChangeMode={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }} />;
}
