import type { FormEvent } from 'react';
import { AppLink, routes } from '../routing';

export type AuthMode = 'login' | 'signup' | 'recovery' | 'reset-password';

export interface AuthCardProps {
  mode: AuthMode;
  email: string;
  busy?: boolean;
  configured?: boolean;
  error?: string;
  message?: string;
  onEmailChange: (email: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onResendConfirmation: () => void;
}

const copy: Record<AuthMode, { eyebrow: string; heading: string; description: string; action: string }> = {
  login: {
    eyebrow: 'Good to have you back',
    heading: 'A little more peace.',
    description: 'Log in to take a breath. Your subscriptions are in good hands.',
    action: 'Log in',
  },
  signup: {
    eyebrow: 'Your next money move',
    heading: 'Less worry. More living.',
    description: 'One card. Your rules. A little more room for the things you love.',
    action: 'Create account',
  },
  recovery: {
    eyebrow: 'Let’s get you back in',
    heading: 'Forgot happens.',
    description: 'Enter your email and we’ll help you find your way back.',
    action: 'Send reset link',
  },
  'reset-password': {
    eyebrow: 'A fresh start',
    heading: 'Choose a new password.',
    description: 'Use a strong password you have not used for this account before.',
    action: 'Save new password',
  },
};

export function AuthCard({
  mode,
  email,
  busy = false,
  configured = true,
  error = '',
  message = '',
  onEmailChange,
  onSubmit,
  onResendConfirmation,
}: AuthCardProps) {
  const content = copy[mode];

  return <section className="panel auth-panel stack" aria-labelledby="auth-heading">
    <div className="stack auth-copy">
      <span className="eyebrow">{content.eyebrow}</span>
      <h1 id="auth-heading">{content.heading}</h1>
      <p className="muted">{content.description}</p>
    </div>
    {!configured && <p className="notice" role="status">
      You can enter your details, but sign-in and account changes need Supabase configuration.
    </p>}
    <form className="stack auth-form" onSubmit={onSubmit}>
      {mode === 'signup' && <label>
        Full name
        <input name="name" autoComplete="name" maxLength={80} required disabled={busy} />
      </label>}
      {mode !== 'reset-password' && <label>
        Email address
        <input
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          required
          disabled={busy}
        />
      </label>}
      {(mode === 'login' || mode === 'signup' || mode === 'reset-password') && <label>
        {mode === 'reset-password' ? 'New password' : 'Password'}
        <input
          name="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={8}
          required
          disabled={busy}
        />
      </label>}
      {mode === 'reset-password' && <label>
        Confirm new password
        <input name="password_confirm" type="password" autoComplete="new-password" minLength={8} required disabled={busy} />
      </label>}
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}
      <button className="button auth-submit" disabled={busy || !configured}>
        {busy ? 'Please wait…' : content.action}
      </button>
    </form>

    {mode === 'login' && <AppLink className="text-link" href={routes.recovery}>Forgot your password?</AppLink>}
    {mode === 'signup' && message && <button className="button button-quiet" type="button" disabled={busy || !email || !configured} onClick={onResendConfirmation}>
      Resend confirmation email
    </button>}
    <div className="auth-switch">
      {mode === 'login' && <p className="muted">New around here? <AppLink href={routes.signup}>Create an account</AppLink></p>}
      {mode === 'signup' && <p className="muted">Already have an account? <AppLink href={routes.login}>Log in</AppLink></p>}
      {(mode === 'recovery' || mode === 'reset-password') && <p className="muted"><AppLink href={routes.login}>Back to log in</AppLink></p>}
    </div>
    {mode === 'login' && <>
      <AppLink className="button button-quiet" href={routes.preview}>Explore the read-only preview</AppLink>
      <p className="demo-note">Authentication is handled by Supabase. The preview has no account data or financial actions.</p>
    </>}
  </section>;
}
