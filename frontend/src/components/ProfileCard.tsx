import type { FormEvent } from 'react';

export interface ProfileCardProps {
  name: string;
  loading?: boolean;
  loaded?: boolean;
  busy?: boolean;
  error?: string;
  message?: string;
  onNameChange: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onRetry: () => void;
}

export function ProfileCard({ name, loading = false, loaded = false, busy = false, error = '', message = '', onNameChange, onSave, onRetry }: ProfileCardProps) {
  return <section className="panel stack" aria-labelledby="profile-heading">
    <span className="eyebrow">Your personal space</span><h2 id="profile-heading">A fresh start.</h2>
    <p className="muted">Set the name you’d like to see in your workspace.</p>
    {loading && <p role="status">Loading your profile…</p>}
    {!loading && loaded && <form className="stack" onSubmit={onSave}>
      <label>Display name<input value={name} onChange={(event) => onNameChange(event.target.value)} maxLength={80} autoComplete="name" /></label>
      <button className="button" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
    </form>}
    {!loading && !loaded && <button className="button button-quiet" onClick={onRetry}>Retry profile load</button>}
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}
  </section>;
}
