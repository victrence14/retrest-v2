import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AuthForm } from './components/AuthForm';
import { ProfilePanel } from './components/ProfilePanel';
import { PwaStatus } from './components/PwaStatus';
import { WorkspaceLayout } from './components/WorkspaceLayout';

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    // INITIAL_SESSION also handles restoring the session and confirmation redirects.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function logout() {
    setError(''); setLoggingOut(true);
    try { const result = await supabase!.auth.signOut(); if (result.error) throw result.error; }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign out.'); }
    finally { setLoggingOut(false); }
  }

  return <WorkspaceLayout status={<PwaStatus />} email={session?.user.email} loggingOut={loggingOut} error={error} onLogout={logout}>
    {loading ? <p role="status">Opening your workspace…</p> : session ? <ProfilePanel key={session.user.id} /> : <AuthForm />}
  </WorkspaceLayout>;
}
