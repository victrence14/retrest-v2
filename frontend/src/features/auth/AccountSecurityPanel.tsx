import { useState, type FormEvent } from 'react';
import { AppLink, routes } from '../../routing';
import { requestEmailChange } from './accountActions';

export function AccountActions({ email }: { email: string }) {
  const [nextEmail, setNextEmail] = useState(email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = nextEmail.trim();
    if (value.toLowerCase() === email.toLowerCase()) {
      setError('Enter an email address different from your current one.');
      setMessage('');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      await requestEmailChange(value, `${window.location.origin}${routes.account}`);
      setMessage('Check your email to confirm the address change. Your account email stays the same until confirmation succeeds.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to request an email change.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel stack" aria-labelledby="account-actions-heading">
    <span className="eyebrow">Account security</span>
    <h2 id="account-actions-heading">Keep your account current.</h2>
    <form className="stack" onSubmit={submit}>
      <label>
        Change email address
        <input type="email" autoComplete="email" value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} required disabled={busy} />
      </label>
      <button className="button button-quiet" disabled={busy}>{busy ? 'Requesting…' : 'Request email change'}</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p className="success" role="status">{message}</p>}
    <div className="account-action-footer">
      <span className="muted">Need a new password?</span>
      <AppLink href={routes.recovery}>Send a password reset link</AppLink>
    </div>
    <AppLink href={routes.deviceBinding}>Review device verification</AppLink>
  </section>;
}
