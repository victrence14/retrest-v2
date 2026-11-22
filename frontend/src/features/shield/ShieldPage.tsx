import { IntegrationNotice } from '../shared/IntegrationNotice';

export function ShieldPage() {
  return <section className="feature-page" aria-labelledby="shield-heading">
    <div className="feature-heading">
      <div>
        <p className="eyebrow">Your money. Your rules.</p>
        <h1 id="shield-heading">Stay in control.</h1>
        <p className="muted">One card. Every subscription protected. A little more peace of mind.</p>
      </div>
    </div>
    <div className="shield-grid" aria-label="Shield overview">
      <article className="overview-card overview-card-primary">
        <span className="card-kicker">Your Shield</span>
        <h2>Protection starts here.</h2>
        <p>Connect your subscriptions and wallet to see upcoming renewals, protected merchants, and safe-to-spend guidance.</p>
        <IntegrationNotice feature="Shield overview" dependency="Wallet, subscription, activity, and insight APIs are not connected in this frontend yet." />
      </article>
      <article className="overview-card">
        <span className="card-kicker">Wallet balance</span>
        <h2>—</h2>
        <p className="muted">No balance is shown until it can be loaded from your account.</p>
      </article>
      <article className="overview-card">
        <span className="card-kicker">Protected subscriptions</span>
        <h2>—</h2>
        <p className="muted">Your confirmed subscriptions will appear here.</p>
      </article>
    </div>
    <div className="overview-card overview-empty">
      <div>
        <p className="card-kicker">Connected subscriptions</p>
        <h2>Your rules are ready when you are.</h2>
        <p className="muted">Subscription management will appear here after the subscription API contract is available.</p>
      </div>
      <IntegrationNotice feature="Subscriptions" dependency="Waiting for BE2's subscription schema and endpoints." />
    </div>
  </section>;
}
