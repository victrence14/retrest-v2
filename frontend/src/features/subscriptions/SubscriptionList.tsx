import { IntegrationNotice } from '../shared/IntegrationNotice';

export function SubscriptionList() {
  return <section className="feature-page" aria-labelledby="subscriptions-heading">
    <div className="feature-heading">
      <div>
        <p className="eyebrow">Your merchant rules</p>
        <h1 id="subscriptions-heading">Subscriptions.</h1>
        <p className="muted">Review the payments your Shield is set up to protect.</p>
      </div>
    </div>
    <div className="overview-card overview-empty">
      <div className="empty-mark" aria-hidden="true">R</div>
      <h2>Your subscriptions will show here.</h2>
      <p className="muted">No subscription data is available until the API supports listing and updating merchant rules.</p>
      <IntegrationNotice feature="Subscriptions" dependency="Waiting for BE2's schema and /api/subscriptions contract." />
    </div>
  </section>;
}
