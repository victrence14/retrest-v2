import { useEffect, useState, type FormEvent } from 'react';
import { profileRequest } from '../lib/api';
import { ProfileCard } from './ProfileCard';

export function ProfilePanel() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    profileRequest().then((profile) => { if (active) setName(profile.display_name); })
      .catch((cause: Error) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { const profile = await profileRequest('PATCH', name); setName(profile.display_name); setMessage('Your profile is saved.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save your profile.'); }
    finally { setBusy(false); }
  }

  return <ProfileCard name={name} loading={loading} busy={busy} error={error} message={message} onNameChange={setName} onSave={save} />;
}
