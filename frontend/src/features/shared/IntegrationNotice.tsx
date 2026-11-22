export function IntegrationNotice({ feature, dependency }: { feature: string; dependency: string }) {
  return <section className="integration-notice" aria-label={`${feature} integration status`}>
    <span className="status-dot" aria-hidden="true" />
    <div>
      <p className="integration-label">Integration pending</p>
      <p className="muted">{dependency}</p>
    </div>
  </section>;
}
