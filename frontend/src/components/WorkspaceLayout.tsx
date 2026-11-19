import type { ReactNode } from 'react';
import { ThemeControl } from '@retrest/design-tokens/react';

export function WorkspaceLayout({ children, status, email, loggingOut = false, error, onLogout }: {
  children: ReactNode;
  status: ReactNode;
  email?: string;
  loggingOut?: boolean;
  error?: string;
  onLogout?: () => void;
}) {
  return <div className="shell">
    <header className="header"><a className="brand" href="/"><span className="brand-mark" aria-hidden="true">✓</span>RETREST</a><ThemeControl /></header>
    <main className="workspace">
      <div className="workspace-intro stack"><span className="badge">Your money. Your rules.</span><h1>A little more<br />financial peace.</h1><p className="muted">One place to begin taking care of your recurring payments. A space that feels like you.</p>{status}
        {email && <div className="stack"><p className="muted">Signed in as {email}</p><button className="button button-quiet" onClick={onLogout} disabled={loggingOut}>{loggingOut ? 'Signing out…' : 'Sign out'}</button></div>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      {children}
    </main>
    <footer className="footer">RETREST · A calmer way to take control.</footer>
  </div>;
}
