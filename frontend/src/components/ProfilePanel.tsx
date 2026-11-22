import { useEffect, useState, type FormEvent } from 'react';
import { profileRequest } from '../lib/api';
import { ProfileCard } from './ProfileCard';
import { AccountActions } from '../features/auth/AccountSecurityPanel';

export function ProfilePanel({ email = '' }: { email?: string }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    let active = true;
    profileRequest('GET', undefined, controller.signal).then((profile) => {
      if (active) {
        setName(profile.display_name);
        setLoaded(true);
      }
    })
      .catch((cause: Error) => { if (active && !controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [attempt]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loaded || loading || busy) return;
    setBusy(true); setError(''); setMessage('');
    try { const profile = await profileRequest('PATCH', name); setName(profile.display_name); setMessage('Your profile is saved.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save your profile.'); }
    finally { setBusy(false); }
  }

  return <div className="account-grid">
    <ProfileCard
      name={name}
      loading={loading}
      loaded={loaded}
      busy={busy}
      error={error}
      message={message}
      onNameChange={setName}
      onSave={save}
      onRetry={() => setAttempt((value) => value + 1)}
    />
    <AccountActions email={email} />
  </div>;
}
