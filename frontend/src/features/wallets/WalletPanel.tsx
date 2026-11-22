import { IntegrationNotice } from '../shared/IntegrationNotice';

export function WalletPanel() {
  return <section className="feature-page" aria-labelledby="wallets-heading">
    <div className="feature-heading">
      <div>
        <p className="eyebrow">Your money, at a glance</p>
        <h1 id="wallets-heading">Wallets.</h1>
        <p className="muted">See your NGN and USD balances and track confirmed funding.</p>
      </div>
    </div>
    <div className="overview-card overview-empty">
      <div className="wallet-currency-row" aria-label="Wallet balances">
        <div><span className="card-kicker">NGN wallet</span><strong>—</strong></div>
        <div><span className="card-kicker">USD wallet</span><strong>—</strong></div>
      </div>
      <h2>Wallet balances are not connected yet.</h2>
      <p className="muted">Balances and funding status will only appear after they come from the API. Funding requests will never be treated as settled before confirmation.</p>
      <IntegrationNotice feature="Wallets" dependency="Waiting for BE1's /api/wallets and funding-intent endpoints." />
    </div>
  </section>;
}
