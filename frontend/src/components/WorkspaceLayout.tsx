import type { ReactNode } from 'react';
import { ThemeControl } from '@retrest/design-tokens/react';
import { AppLink, routes } from '../routing';

const navigation = [
  { href: routes.shield, label: 'Shield' },
  { href: routes.subscriptions, label: 'Subscriptions' },
  { href: routes.wallets, label: 'Wallets' },
  { href: routes.card, label: 'Card controls' },
  { href: routes.account, label: 'Account settings' },
];

export function WorkspaceLayout({ children, status, activePath, email, loggingOut = false, error, readOnlyPreview = false, onLogout }: {
  children: ReactNode;
  status?: ReactNode;
  activePath: string;
  email?: string;
  loggingOut?: boolean;
  error?: string;
  readOnlyPreview?: boolean;
  onLogout?: () => void;
}) {
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar" aria-label="Workspace navigation">
      <AppLink className="brand" href={readOnlyPreview ? routes.preview : routes.shield}><span className="brand-mark" aria-hidden="true">R</span><span>retrest<span className="brand-period">.</span></span></AppLink>
      <p className="nav-caption">Your workspace</p>
      <nav className="primary-nav">
        {navigation.map((item) => <AppLink
          key={item.href}
          className={`nav-link${activePath === item.href ? ' is-active' : ''}`}
          href={item.href}
          aria-current={activePath === item.href ? 'page' : undefined}
        >
          <span className="nav-indicator" aria-hidden="true" />
          {item.label}
        </AppLink>)}
      </nav>
      <div className="sidebar-note">
        <span className="sidebar-note-mark" aria-hidden="true">R</span>
        <strong>{readOnlyPreview ? 'A read-only design preview.' : 'Your money, with more clarity.'}</strong>
        <p>{readOnlyPreview ? 'No account data or financial actions are available in this preview.' : 'Account controls appear when the connected service can confirm them.'}</p>
      </div>
      <div className="sidebar-account">
        <span className="avatar" aria-hidden="true">{email?.slice(0, 1).toUpperCase() || 'R'}</span>
        <div className="account-copy">
          <strong>{email || (readOnlyPreview ? 'Read-only preview' : 'Your account')}</strong>
          <span>{readOnlyPreview ? 'Sample layout only' : 'Personal workspace'}</span>
        </div>
        {!readOnlyPreview && <button className="signout-button" onClick={onLogout} disabled={loggingOut} aria-label="Sign out" title="Sign out">
          {loggingOut ? 'Wait' : 'Sign out'}
        </button>}
      </div>
    </aside>

    <div className="app-main">
      <header className="topbar">
        <div className="breadcrumbs"><span>Workspace</span><span aria-hidden="true">/</span><strong>{navigation.find((item) => item.href === activePath)?.label ?? 'Account'}</strong></div>
        <div className="topbar-actions"><span className="connection-indicator">{readOnlyPreview ? 'Read-only design preview' : 'Personal workspace'}</span><ThemeControl /></div>
      </header>
      {status}
      {error && <p className="session-error" role="alert">{error}</p>}
      <main className="main-content" id="main-content">{children}</main>
      <footer className="app-footer">RETREST <span>·</span> A calmer way to take control.</footer>
    </div>

    <nav className="mobile-nav" aria-label="Mobile workspace navigation">
      {navigation.map((item) => <AppLink
        key={item.href}
        className={`mobile-nav-link${activePath === item.href ? ' is-active' : ''}`}
        href={item.href}
        aria-current={activePath === item.href ? 'page' : undefined}
      >
        <span className="mobile-nav-indicator" aria-hidden="true" />
        {item.label === 'Subscriptions' ? 'Plans' : item.label === 'Card controls' ? 'Card' : item.label === 'Account settings' ? 'Account' : item.label}
      </AppLink>)}
    </nav>
  </div>;
}
