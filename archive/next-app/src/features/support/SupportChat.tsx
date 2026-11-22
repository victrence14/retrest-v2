"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, ArrowUpRight, FileText, MessageCircle, Send, ShieldCheck, Users, Wallet, Zap } from "lucide-react";
import { supportContract } from "./api";
import "./styles.css";

// Static help articles are presented as documentation, never as support replies.
const topics = [
  { label: "Fund my wallet", icon: Wallet, title: "Wallet funding in the demo", text: "Shield shows your NGN and USD balances. Fund wallet adds simulated funds. Real bank funding is not connected.", href: "/shield", action: "Open Shield" },
  { label: "A blocked payment", icon: ShieldCheck, title: "Understand a declined payment", text: "A payment can be blocked when a merchant is paused, its charge exceeds your limit, the currency does not match, or funds are insufficient. Transactions shows the server’s exact decision reason. Reviewing a new price limit only changes future merchant attempts.", href: "/transactions", action: "Open transactions" },
  { label: "Split a subscription", icon: Users, title: "Shared subscription pools", text: "Create a pool from an eligible subscription and include the host email. Shares must equal the plan total exactly. Contributions in this build are simulated; the host can choose whether the wallet covers any shortfall.", href: "/pools", action: "Open pools" },
  { label: "Auto-conversion", icon: Zap, title: "Just-in-time dollar conversion", text: "Auto-conversion covers a USD shortfall from the NGN wallet using the server’s simulated quote. The preference is saved on the server. Review the current quote in Insights; real FX liquidity is not connected.", href: "/settings", action: "Open money preferences" },
];

export function SupportChat({ name }: { name: string }) {
  const id = useId();
  const [selected, setSelected] = useState(1);
  const topic = topics[selected];
  return <div className="fe2-support support-grid">
    <section className="panel chat-panel">
      <div className="chat-header"><span className="chat-guide-avatar"><MessageCircle size={22} /></span><div><h2>Help for your next step.</h2><p>Hi {name.trim().split(/\s+/)[0] || "there"}. Choose a help topic below.</p></div><span className="badge neutral">Help articles</span></div>
      <div className="fe2-support-availability"><b>Live support unavailable</b><p>{supportContract.reason}</p><small>Service availability has not been supplied.</small></div>
      <nav className="fe2-support-topics" aria-label="Help topics">{topics.map((item, index) => <button key={item.label} type="button" aria-pressed={index === selected} onClick={() => setSelected(index)}><item.icon size={15} />{item.label}<ArrowRight size={13} /></button>)}</nav>
      <article className="fe2-support-article" aria-label="Help article"><span className="eyebrow">RETREST DEMO GUIDE</span><h3>{topic.title}</h3><p>{topic.text}</p><Link href={topic.href} className="text-button">{topic.action}<ArrowUpRight size={14} /></Link></article>
      <div className="fe2-support-compose"><label htmlFor={`${id}-message`}>Your message<textarea id={`${id}-message`} disabled rows={2} placeholder="Messaging is unavailable until live support is connected." /></label><button type="button" className="button secondary" aria-label="Send message" disabled><Send size={15} />Messaging unavailable</button></div>
    </section>
    <aside className="support-side"><section className="panel support-receipt-panel"><FileText size={23} /><h3>Checking a payment?</h3><p>Transaction details show decision reasons and the confirmed funding breakdown. Only eligible demo payments have receipts.</p><Link href="/transactions" className="text-button">Open transactions<ArrowUpRight size={14} /></Link></section><section className="panel fe2-support-service-note"><h3>Conversations will appear here after support is connected.</h3><p>This build does not create tickets, deliver messages to an agent, or retain a conversation history.</p></section></aside>
  </div>;
}

export default SupportChat;
