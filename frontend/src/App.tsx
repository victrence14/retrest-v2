import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ThemeControl } from '@retrest/design-tokens/react';
import { supabase } from './lib/supabase';
import { AuthForm } from './components/AuthForm';
import type { AuthMode } from './components/AuthCard';
import { ProfilePanel } from './components/ProfilePanel';
import { PwaStatus } from './components/PwaStatus';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { DeviceBindingPage } from './features/auth/DeviceBindingPage';
import { CardPanel } from './features/card/CardPanel';
import { ShieldPage } from './features/shield/ShieldPage';
import { SubscriptionList } from './features/subscriptions/SubscriptionList';
import { WalletPanel } from './features/wallets/WalletPanel';
import { AppLink, matchRoute, navigateTo, routes, safeReturnPath, useCurrentLocation } from './routing';

function AuthShell({ children }: { children: ReactNode }) {
  return <div className="auth-shell">
    <a className="skip-link" href="#auth-main">Skip to content</a>
    <header className="auth-topbar">
      <AppLink className="brand" href="/"><span className="brand-mark" aria-hidden="true">R</span><span>retrest<span className="brand-period">.</span></span></AppLink>
      <div className="auth-topbar-actions"><span>Frontend preview</span><ThemeControl /></div>
    </header>
    <PwaStatus />
    <main className="auth-layout" id="auth-main">
      <section className="auth-story">
        <p className="eyebrow"><span className="story-dot" /> A little more financial peace</p>
        <h1>Your money.<br />Your rules<span className="brand-period">.</span></h1>
        <p className="auth-story-copy">One card for the things you love.<br />A Shield for the money you’ve earned.</p>
        <div className="story-card" aria-hidden="true">
          <div className="story-card-top"><span>RETREST</span><span>DESIGN PREVIEW</span></div>
          <div className="story-card-number">CARD DETAILS HIDDEN</div>
          <div className="story-card-bottom"><span>YOUR RULES</span><span>RETREST CARD</span></div>
        </div>
        <ul className="story-points">
          <li>Every merchant follows your rules</li>
          <li>Dollars only when you need them</li>
        </ul>
      </section>
      <div className="auth-content">{children}</div>
    </main>
    <footer className="auth-footer">RETREST <span>·</span> A calmer way to take control.</footer>
  </div>;
}

function NotFound({ protectedLink = false }: { protectedLink?: boolean }) {
  return <section className="overview-card overview-empty" aria-labelledby="not-found-heading">
    <p className="eyebrow">Page not found</p>
    <h1 id="not-found-heading">We couldn’t find that page.</h1>
    <p className="muted">Check the address, or return to your Shield overview.</p>
    <AppLink className="button" href={protectedLink ? routes.shield : routes.login}>{protectedLink ? 'Go to Shield' : 'Go to sign in'}</AppLink>
  </section>;
}

function modeForPath(pathname: string): AuthMode {
  if (pathname === routes.signup) return 'signup';
  if (pathname === routes.recovery) return 'recovery';
  if (pathname === routes.resetPassword) return 'reset-password';
  return 'login';
}

export function App() {
  const location = useCurrentLocation();
  const url = new URL(location, window.location.origin);
  const pathname = url.pathname;
  const route = matchRoute(pathname);
  const requestedReturn = safeReturnPath(url.searchParams.get('next'));
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleSessionExpired() {
      const returnPath = safeReturnPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      setSession(null);
      navigateTo(`${routes.login}?next=${encodeURIComponent(returnPath)}`, true);
    }
    window.addEventListener('retrest:session-expired', handleSessionExpired);
    return () => window.removeEventListener('retrest:session-expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (pathname === '/') {
      navigateTo(session ? routes.shield : routes.login, true);
      return;
    }
    if (route.kind === 'protected' && !session) {
      navigateTo(`${routes.login}?next=${encodeURIComponent(`${pathname}${url.search}${url.hash}`)}`, true);
      return;
    }
    if ((pathname === routes.login || pathname === routes.signup) && session) {
      navigateTo(requestedReturn, true);
    }
  }, [loading, pathname, route.kind, session, requestedReturn, url.hash, url.search]);

  async function logout() {
    if (!supabase) return;
    setError('');
    setLoggingOut(true);
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
      navigateTo(routes.login, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign out.');
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading || (pathname === '/' && !loading)) {
    return <div className="route-loading" role="status">{loading ? 'Opening your workspace…' : 'Opening RETREST…'}</div>;
  }

  if (route.kind === 'protected' && !session) {
    return <div className="route-loading" role="status">Taking you to sign in…</div>;
  }

  if (route.kind === 'public') {
    if (pathname === routes.preview) {
      return <WorkspaceLayout status={<PwaStatus />} activePath={routes.shield} readOnlyPreview>
        <div className="preview-banner">Read-only design preview - no account data or financial actions</div>
        <ShieldPage />
      </WorkspaceLayout>;
    }
    return <AuthShell><AuthForm mode={modeForPath(pathname)} returnTo={requestedReturn} /></AuthShell>;
  }
  if (route.kind === 'not-found' && !session) {
    return <AuthShell><NotFound /></AuthShell>;
  }

  return <WorkspaceLayout
    status={<PwaStatus />}
    activePath={pathname === routes.deviceBinding ? routes.account : pathname}
    email={session?.user.email}
    loggingOut={loggingOut}
    error={error}
    onLogout={logout}
  >
    {route.kind === 'not-found' ? <NotFound protectedLink /> :
      pathname === routes.shield ? <ShieldPage /> :
      pathname === routes.subscriptions ? <SubscriptionList /> :
      pathname === routes.wallets ? <WalletPanel /> :
      pathname === routes.card ? <CardPanel /> :
      pathname === routes.account ? <ProfilePanel email={session?.user.email ?? ''} /> :
      pathname === routes.deviceBinding ? <DeviceBindingPage /> : <NotFound />}
  </WorkspaceLayout>;
}
