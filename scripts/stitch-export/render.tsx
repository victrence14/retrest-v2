import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider, ThemeControl } from '../../design-tokens/src/theme';
import { AuthCard } from '../../frontend/src/components/AuthCard';
import { ProfileCard } from '../../frontend/src/components/ProfileCard';
import { WorkspaceLayout } from '../../frontend/src/components/WorkspaceLayout';
import { PwaStatus } from '../../frontend/src/components/PwaStatus';
import { App as LandingPage } from '../../landing-page/src/App';
import { setPwaFixture } from './pwa';

const noop = () => {};

function ComponentSheet() {
  return <div className="shell">
    <header className="header"><a className="brand" href="landing-light-desktop.html"><span className="brand-mark" aria-hidden="true">✓</span>RETREST</a><ThemeControl /></header>
    <main className="reference stack">
      <div className="stack"><span className="eyebrow">Design system reference</span><h1>Components and states.</h1><p className="muted">Reference sheet for the current starter. Examples use fictional data.</p></div>
      <section className="panel stack" aria-labelledby="buttons-heading"><h2 id="buttons-heading">Buttons and inputs</h2>
        <div className="row"><button className="button">Primary</button><button className="button button-quiet">Quiet</button><button className="button reference-hover">Hover</button><button className="button reference-focus">Focus</button><button className="button" disabled>Disabled</button><button className="button" disabled>Please wait…</button><button className="button" disabled>Saving…</button></div>
        <div className="reference-grid"><label>Default input<input value="Alex Morgan" readOnly /></label><label>Focus input<input className="reference-focus" value="Alex Morgan" readOnly /></label><label>Error message<input value="alex@example.test" readOnly /><span className="error" role="alert">Unable to sign in. Please try again.</span></label></div>
        <p className="success" role="status">Check your email to confirm your account, then sign in.</p>
        <p role="status">Loading your profile…</p><p role="status">Opening your workspace…</p>
        <p className="notice" role="status">Account access is awaiting setup. You can still explore the app and change its appearance.</p>
        <p className="notice" role="status">Offline support could not start. Reload while connected to try again.</p>
        <div className="row"><span className="badge">Your money. Your rules.</span><span className="eyebrow">Reusable eyebrow</span><button className="button button-quiet">Install RETREST</button></div>
      </section>
      <div className="reference-grid"><AuthCard mode="login" busy error="Unable to sign in. Please try again." onSubmit={noop} onChangeMode={noop} /><ProfileCard name="Alex Morgan" message="Your profile is saved." onNameChange={noop} onSave={noop} /></div>
      <section className="panel stack" aria-labelledby="availability-heading"><h2 id="availability-heading">PWA notices and update states</h2><PwaStatus /></section>
    </main><footer className="footer">RETREST · Shared component reference.</footer>
  </div>;
}

export function renderScreen(id: string, theme: 'light' | 'dark') {
  const overrides: Record<string, unknown> = {
    matchMedia: () => ({ matches: theme === 'dark' }),
    localStorage: { getItem: () => theme },
    navigator: { onLine: id !== 'offline' },
  };
  const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(overrides)) Object.defineProperty(globalThis, key, { value, configurable: true });
  setPwaFixture({ offlineReady: id === 'components', needRefresh: id === 'components' });
  try {
    const view = id === 'landing' ? <LandingPage /> : id === 'components' ? <ComponentSheet /> :
      <WorkspaceLayout status={<PwaStatus />} email={id === 'profile' ? 'alex@example.test' : undefined} onLogout={noop}>
        {id === 'profile' ? <ProfileCard name="Alex Morgan" onNameChange={noop} onSave={noop} /> : <AuthCard mode={id === 'signup' ? 'signup' : 'login'} onSubmit={noop} onChangeMode={noop} />}
      </WorkspaceLayout>;
    return renderToStaticMarkup(<ThemeProvider>{view}</ThemeProvider>);
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}
