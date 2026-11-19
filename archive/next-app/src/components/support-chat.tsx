"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRight, ArrowUpRight, Check, FileText, MessageCircle, Send, ShieldCheck, Sparkles, Users, Wallet } from "lucide-react";

interface Message { id: number; role: "guide" | "user"; text: string; time?: string }
const questions = [
  { label: "Fund my wallet", message: "How do I fund my wallet?", icon: Wallet },
  { label: "A blocked payment", message: "Why was my payment blocked?", icon: ShieldCheck },
  { label: "Split a subscription", message: "How do shared pools work?", icon: Users },
  { label: "Auto-conversion", message: "How does automatic dollar conversion work?", icon: Sparkles },
];

function answer(message: string) {
  const text = message.toLowerCase();
  if (/human|agent|team|person|live support/.test(text)) return "You’re chatting with the RETREST preview guide. Live support will connect in the next phase. For now, I can help you explore your wallets, subscription rules, shared pools, and receipts.";
  if (/password|log.?in|sign.?up|account|device|encrypt|security/.test(text)) return "You can preview sign up, login, password recovery, and trusted-device setup from Account settings. Account authentication and verified device binding connect in the next phase. Please keep passwords and card details out of this chat.";
  if (/block|declin|pause|kill|price/.test(text)) return "A payment can be blocked when a merchant is paused, its charge exceeds your limit, the currency doesn’t match, or funding is insufficient. Open Transactions to see the exact reason. You can change a merchant’s limit or pause status from Shield.";
  if (/pool|split|friend|contribution/.test(text)) return "Open Pools & Split, choose Create a pool, and add your friends with equal or custom shares. Share the invite link so they can preview a contribution. Pool funds cover the bill first; your wallet fills the gap only when host fallback is on.";
  if (/dollar|usd|fx|convert|conversion/.test(text)) return "With auto-conversion on, RETREST converts only the missing dollars from your NGN wallet when a subscription charges. The current demo quote is ₦1,535.25 per USD. You can switch auto-conversion on or off in Account settings or Insights & Vault.";
  if (/receipt|export|business|statement/.test(text)) return "Every approved subscription payment has a receipt in Transactions. Open Insights & Vault to filter business expenses by month and download a CSV or PDF receipt pack.";
  if (/fund|balance|wallet|top.?up|money/.test(text)) return "Your NGN and USD balances are shown on Shield and Transactions. Choose Fund wallet to add simulated funds in either currency. Real bank funding connects in the payment-provider phase.";
  if (/hello|hi\b|hey|thank/.test(text)) return "Good to have you here. What can I help you explore—your wallet, a subscription payment, shared pools, or receipts?";
  return "I can help with wallet funding, blocked payments, shared subscriptions, automatic FX, and receipts. Try one of the quick questions, or open Transactions if you’re checking a particular payment.";
}

export default function SupportChat({ name }: { name: string }) {
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: "guide", text: "Hi there. I’m your RETREST preview guide. What can I help you with today?" }]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const thread = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  useEffect(() => { if (thread.current) thread.current.scrollTop = thread.current.scrollHeight; }, [messages, typing]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function send(text: string) {
    const message = text.trim();
    if (!message || typing) return;
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    setMessages(previous => [...previous, { id: nextId.current++, role: "user", text: message.slice(0, 2000), time }]);
    setDraft(""); setTyping(true);
    timer.current = setTimeout(() => {
      setMessages(previous => [...previous, { id: nextId.current++, role: "guide", text: answer(message), time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }]);
      setTyping(false);
    }, 650);
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); send(draft); }
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(draft); }
  }

  return <div className="support-grid">
    <section className="panel chat-panel">
      <div className="chat-header"><span className="chat-guide-avatar"><ShieldCheck size={22} /></span><div><h2>Chat with us</h2><p><span className="status-dot" /> RETREST preview guide</p></div><span className="badge neutral">Demo chat</span></div>
      <div className="chat-preview-banner"><Sparkles size={13} /> Automated preview answers. Live support connects later.</div>
      <div className="chat-thread" ref={thread} role="log" aria-live="polite" aria-label="Support conversation">
        <div className="chat-day">TODAY</div>
        {messages.map(message => <div key={message.id} className={"chat-message " + message.role}>
          {message.role === "guide" && <span className="chat-small-avatar"><ShieldCheck size={14} /></span>}
          <div><span className="chat-sender">{message.role === "guide" ? "RETREST guide" : name.split(" ")[0] || "You"}</span><p>{message.text}</p>{message.time && <small>{message.time}{message.role === "user" && <Check size={10} />}</small>}</div>
        </div>)}
        {typing && <div className="chat-typing" role="status"><span className="chat-small-avatar"><ShieldCheck size={14} /></span><span><i /><i /><i /></span><span className="sr-only">The preview guide is replying</span></div>}
      </div>
      <div className="chat-quick-questions">{questions.map(question => <button type="button" key={question.label} disabled={typing} onClick={() => send(question.message)}>{question.label}<ArrowUpRight size={11} /></button>)}</div>
      <form onSubmit={submit} className="chat-compose">
        <label htmlFor="support-message" className="sr-only">Your message</label>
        <textarea id="support-message" name="message" placeholder="What’s on your mind?" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={keyDown} maxLength={2000} rows={2} />
        <button type="submit" className="chat-send" aria-label="Send message" disabled={!draft.trim() || typing}><Send size={19} /></button>
        <div className="chat-compose-note"><span>Enter to send · Shift + Enter for a new line</span><span>{draft.length}/2000</span></div>
      </form>
    </section>
    <aside className="support-side">
      <section className="panel support-help-panel"><span className="icon-well"><MessageCircle size={20} /></span><h2>A little clarity<br />goes a long way<span>.</span></h2><p>Start with a question. We’ll point you in the right direction.</p>
        <div className="support-topics">{questions.map(question => <button type="button" key={question.label} disabled={typing} onClick={() => send(question.message)}><question.icon size={16} /><span>{question.label}</span><ArrowRight size={14} /></button>)}</div>
      </section>
      <section className="panel support-receipt-panel"><FileText size={23} /><h3>Checking a payment?</h3><p>Your transaction history explains every approval and block.</p><Link href="/transactions" className="text-button">Open transactions <ArrowUpRight size={14} /></Link></section>
      <div className="support-privacy-note"><ShieldCheck size={16} /><p>Keep passwords, PINs, and full card numbers out of your messages.</p></div>
    </aside>
  </div>;
}
