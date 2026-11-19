export function FeatureCard({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <article className="panel stack"><span className="eyebrow">{number}</span><h3>{title}</h3><p className="muted">{children}</p></article>;
}
