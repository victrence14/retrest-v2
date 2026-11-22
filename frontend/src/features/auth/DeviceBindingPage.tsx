import { IntegrationNotice } from '../shared/IntegrationNotice';

export function DeviceBindingPage() {
  return <section className="feature-page" aria-labelledby="device-heading">
    <div className="feature-heading">
      <div>
        <p className="eyebrow">Account security</p>
        <h1 id="device-heading">Verify this device.</h1>
        <p className="muted">Device trust must be confirmed by the server before this browser can be trusted.</p>
      </div>
    </div>
    <div className="overview-card overview-empty">
      <h2>Device verification is not available yet.</h2>
      <p className="muted">This preview will not accept a fixed code or mark a device trusted in the browser.</p>
      <IntegrationNotice feature="Device verification" dependency="Waiting for BE2's server-issued device challenge and verification endpoints." />
    </div>
  </section>;
}
