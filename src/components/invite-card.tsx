"use client";

import { useState, type FormEvent } from "react";
import { Users, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";

interface Props {
  token: string; name: string; host: string; merchant: string;
  amount: string; date: string; demo: boolean;
}

export default function InviteCard({ token, name, host, merchant, amount, date, demo }: Props) {
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function contribute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/invites/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email") }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      setResult(value.message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not settle contribution");
    } finally { setBusy(false); }
  }

  return <section className="panel invite-public-card">
    <span className="success-circle"><Users size={27}/></span>
    <div className="eyebrow">YOU’RE INVITED</div>
    <h1>{name}<span>.</span></h1>
    <p>{host} invited you to split {merchant}.</p>
    <div className="merchant-info"><span>Plan total<b>{amount}/month</b></span><span>Next renewal<b>{date}</b></span></div>
    {result ? <div className="invite-success"><CheckCircle2 size={22}/><p>{result}</p></div> :
      <form onSubmit={contribute}>
        <label>Your invited email address<input type="email" name="email" placeholder="you@example.com" required/></label>
        <small>Use the email your host added to the pool.</small>
        {error && <p className="form-error">{error}</p>}
        <button className="button primary full-width" disabled={busy || !demo}>
          {busy ? "Settling…" : demo ? "Simulate my contribution" : "Contributions available after provider setup"}<ArrowRight size={15}/>
        </button>
      </form>}
    <span className="invite-shield"><ShieldCheck size={15}/>One card. Shared plans. Protected payments.</span>
    <a href="/" className="text-button">Go to RETREST <ArrowRight size={14}/></a>
  </section>;
}
