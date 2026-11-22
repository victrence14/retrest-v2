import { IntegrationNotice } from '../shared/IntegrationNotice';

export function CardPanel() {
  return <section className="feature-page" aria-labelledby="card-heading">
    <div className="feature-heading">
      <div>
        <p className="eyebrow">Your card, your call</p>
        <h1 id="card-heading">Card controls.</h1>
        <p className="muted">Manage card availability and reveal card details through a secure issuer flow.</p>
      </div>
    </div>
    <div className="overview-card card-placeholder">
      <div className="card-placeholder-mark" aria-hidden="true">RETREST</div>
      <h2>Card controls are not connected.</h2>
      <p className="muted">Card status and freeze controls will appear when the issuer integration is available. Sensitive card data will not be stored in this app.</p>
      <IntegrationNotice feature="Card controls" dependency="Waiting for BE1's card API and issuer-hosted secure reveal flow." />
    </div>
  </section>;
}
