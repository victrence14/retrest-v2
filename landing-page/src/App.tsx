import { ThemeControl } from '@retrest/design-tokens/react';
import { FeatureCard } from './components/FeatureCard';

export function App() {
  const appUrl = import.meta.env.VITE_APP_URL || 'http://localhost:5173';
  return <div className="shell">
    <header className="header"><a className="brand" href="/"><span className="brand-mark" aria-hidden="true">✓</span>RETREST</a><div className="row"><ThemeControl /><a className="button" href={appUrl}>Open app ↗</a></div></header>
    <main>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-copy stack"><span className="eyebrow">Your money. Your rules.</span><h1 id="hero-heading">Make room<br />for <span>peace.</span></h1><p className="muted">A calmer home for your recurring payments. Start with your own space, then build the habits that put you in control.</p><div className="row"><a className="button" href={appUrl}>Get started <span aria-hidden="true">→</span></a><a className="button button-quiet" href="#possibilities">Explore RETREST</a></div><p className="hero-note muted">A new beginning for your financial routine.</p></div>
        <div className="hero-visual panel stack" aria-label="RETREST product preview">
          <div className="row"><span className="badge">A little more clarity</span><span className="muted">01 / Your space</span></div>
          <div className="preview-card stack"><span>RETREST</span><h2>Financial peace,<br />on your terms.</h2><span className="muted">Designed around you.</span></div>
          <div className="preview-row"><span>One clear view</span><span className="badge">Less noise</span></div>
          <div className="preview-row"><span>A familiar rhythm</span><span className="badge">More control</span></div>
          <p className="muted hero-note">An early look at the experience we’re building.</p>
        </div>
      </section>
      <section className="possibilities stack" id="possibilities" aria-labelledby="possibilities-heading"><span className="eyebrow">A thoughtful foundation</span><h2 id="possibilities-heading">A space that grows with you.</h2><div className="feature-grid">
        <FeatureCard number="01 / Personal" title="Your own starting point.">Create your account and make your workspace feel like you.</FeatureCard>
        <FeatureCard number="02 / Comfortable" title="At home, day or night.">Choose a light or dark appearance that suits your rhythm.</FeatureCard>
        <FeatureCard number="03 / Always nearby" title="A place on your home screen.">Install RETREST and return to your space, even when you’re offline.</FeatureCard>
      </div></section>
      <section className="closing panel row"><div className="stack"><h2>Your next chapter starts here.</h2><p className="muted">Bring a little more calm to the everyday.</p></div><a className="button" href={appUrl}>Open your workspace →</a></section>
    </main>
    <footer className="footer row"><span>© {new Date().getFullYear()} RETREST</span><span>A little more financial peace.</span></footer>
  </div>;
}
