import { ThemeControl } from '@retrest/design-tokens/react';
import { FeatureCard } from './components/FeatureCard';
import { productDestination } from './lib/product-destination';

export function App() {
  const appUrl = productDestination(import.meta.env.VITE_APP_URL, import.meta.env.PROD);
  return <div className="shell landing-pitch">
    <header className="header"><a className="brand" href="/"><span className="brand-mark" aria-hidden="true">✓</span>RETREST</a><div className="row"><ThemeControl /><a className="button" href={appUrl} data-product-cta>Open demo ↗</a></div></header>
    <main>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-copy stack"><span className="eyebrow">Your money. Your rules.</span><h1 id="hero-heading">Your plans.<br /><span>Your rules.</span></h1><p className="muted">Explore recurring payment control: pause a merchant, review a price limit, split a subscription, and download business receipts.</p><div className="row"><a className="button" href={appUrl} data-product-cta>Explore the product demo <span aria-hidden="true">→</span></a><a className="button button-quiet" href="#possibilities">What you can try</a></div><p className="hero-note muted">Product demonstration. Card issuance, funding, FX and settlement are simulated.</p></div>
        <div className="hero-visual panel stack" aria-label="RETREST product preview">
          <div className="row"><span className="badge">Product demo</span><span className="muted">01 / Your shield</span></div>
          <div className="preview-card stack"><span>RETREST</span><h2>Subscription control,<br />on your terms.</h2><span className="muted">NGN & USD · simulated payments</span></div>
          <div className="preview-row"><span>Merchant controls</span><span className="badge">Server saved</span></div>
          <div className="preview-row"><span>Business receipt packs</span><span className="badge">CSV & PDF</span></div>
          <p className="muted hero-note">Illustrative preview. Launch the product demo to try the connected journeys.</p>
        </div>
      </section>
      <section className="possibilities stack" id="possibilities" aria-labelledby="possibilities-heading"><span className="eyebrow">Try the working demonstration</span><h2 id="possibilities-heading">A clearer recurring payment routine.</h2><div className="feature-grid">
        <FeatureCard number="01 / Merchant rules" title="Pause a plan. Set a limit.">The demo engine checks merchant controls and records the reason for each approval or decline.</FeatureCard>
        <FeatureCard number="02 / Shared plans" title="Split a subscription.">Create equal or custom shares, then rehearse a clearly labeled simulated contribution.</FeatureCard>
        <FeatureCard number="03 / Business exports" title="Keep your receipts together.">Download a complete monthly business receipt pack in CSV or PDF from the authenticated demo.</FeatureCard>
      </div></section>
      <section className="closing panel row"><div className="stack"><h2>Your next demo starts here.</h2><p className="muted">Live support and email delivery are not connected. Account/device screens in the financial demo are previews.</p></div><a className="button" href={appUrl} data-product-cta>Open the product demo →</a></section>
    </main>
    <footer className="footer row"><span>© {new Date().getFullYear()} RETREST</span><span>A little more financial peace.</span></footer>
  </div>;
}
