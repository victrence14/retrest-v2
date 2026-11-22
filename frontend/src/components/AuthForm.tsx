import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { AuthCard } from './AuthCard';
import type { AuthMode } from './AuthCard';
import { navigateTo } from '../routing';
import { resendSignupConfirmation, sendPasswordRecovery, updateAccountPassword } from '../features/auth/accountActions';

export function AuthForm({ mode, returnTo }: { mode: AuthMode; returnTo: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const formEmail = String(form.get('email') ?? email).trim();
    const password = String(form.get('password') ?? '');
    setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'login') {
        const result = await supabase.auth.signInWithPassword({ email: formEmail, password });
        if (result.error) throw result.error;
        navigateTo(returnTo, true);
      } else if (mode === 'signup') {
        const result = await supabase.auth.signUp({
          email: formEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${returnTo}`,
            data: { display_name: String(form.get('name') ?? '').trim() },
          },
        });
        if (result.error) throw result.error;
        setEmail(formEmail);
        if (result.data.session) navigateTo(returnTo, true);
        else setMessage('Check your email to confirm your account. You can resend the confirmation below.');
      } else if (mode === 'recovery') {
        await sendPasswordRecovery(formEmail, `${window.location.origin}/reset-password`);
        setEmail(formEmail);
        setMessage('If an account exists for that email, a password reset link is on its way.');
      } else {
        const confirmation = String(form.get('password_confirm') ?? '');
        if (password !== confirmation) {
          setError('The passwords do not match.');
          return;
        }
        await updateAccountPassword(password);
        setMessage('Your password has been updated.');
        navigateTo(returnTo, true);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.'); }
    finally { setBusy(false); }
  }

  async function resendConfirmation() {
    if (!supabase || !email) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await resendSignupConfirmation(email);
      setMessage('A new confirmation email has been sent.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to resend the confirmation email.');
    } finally {
      setBusy(false);
    }
  }

  return <AuthCard
    mode={mode}
    email={email}
    busy={busy}
    configured={Boolean(supabase)}
    error={error}
    message={message}
    onEmailChange={setEmail}
    onSubmit={submit}
    onResendConfirmation={resendConfirmation}
  />;
}
