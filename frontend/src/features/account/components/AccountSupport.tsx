"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MessageCircle, Plus, RefreshCw, Send } from "lucide-react";
import type { SupportMessageRecord, SupportThreadRecord } from "@retrest/shared";
import { DialogFrame, EmptyState } from "@/components/ui";
import { errorMessage } from "@/lib/api/client";
import { createAccountSupportThread, getAccountSupportThread, sendAccountSupportMessage, supportAvailability, updateAccountSupportThread } from "../api";
import { useAccount } from "../AccountContext";
import { beginAccountOperation, finishAccountOperation } from "../operations";
import { useAccountPage } from "../useAccountPage";
import { AccountListStatus } from "./AccountListStatus";

function NewConversation({ close, created }: { close: () => void; created: (thread: SupportThreadRecord) => Promise<void> }) {
  const { user, busy, run } = useAccount();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const subject = String(form.get("subject")).trim(), body = String(form.get("body")).trim();
    const result = await run(async () => {
      const operation = await beginAccountOperation(user.id, "support-new", { subject, body });
      const result = await createAccountSupportThread(subject, body, operation.key);
      finishAccountOperation(user.id, "support-new", operation.key);
      return result;
    }, "Your message is saved in the support inbox.");
    if (result) { close(); await created(result.thread); }
  }
  return <DialogFrame label="New support conversation" busy={busy} onClose={close}><div className="account-dialog-heading"><span className="eyebrow">HERE TO HELP</span><h2>Start a conversation</h2><p>Messages are saved to your account. Check back here for replies.</p></div>
    <form className="account-form" onSubmit={submit}><label>Subject<input name="subject" maxLength={160} required /></label><label>Your message<textarea name="body" maxLength={4000} rows={6} required /></label>
      <button className="button primary" disabled={busy}><Send size={15} />Send message</button></form>
  </DialogFrame>;
}

function Conversation({ initial, accepting, changed }: { initial: SupportThreadRecord; accepting: boolean; changed: () => Promise<void> }) {
  const { user, busy, run, onError } = useAccount();
  const [thread, setThread] = useState(initial);
  const [body, setBody] = useState("");
  const messages = useAccountPage<SupportMessageRecord>(`support/threads/${thread.id}/messages`, {}, onError);
  useEffect(() => { setThread(initial); }, [initial]);
  async function refresh() {
    try { setThread((await getAccountSupportThread(thread.id)).thread); await messages.refresh(); }
    catch (failure) { onError(failure); }
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    const result = await run(async () => {
      const scope = `support-message:${thread.id}`;
      const operation = await beginAccountOperation(user.id, scope, { body: text });
      const result = await sendAccountSupportMessage(thread.id, text, operation.key);
      finishAccountOperation(user.id, scope, operation.key);
      return result;
    }, "Message saved.");
    if (result) { setBody(""); await Promise.all([refresh(), changed()]); }
  }
  async function status() {
    const result = await run(() => updateAccountSupportThread(thread.id, thread.status === "OPEN" ? "CLOSED" : "OPEN"), "Conversation updated.");
    if (result) { setThread(result.thread); await changed(); }
  }
  const ordered = [...messages.rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  return <section className="panel account-conversation"><div className="section-header"><div><h2>{thread.subject}</h2><p>{thread.status === "OPEN" ? "Open conversation" : "Closed conversation"} · Replies appear here</p></div><div className="account-actions"><button className="icon-button" aria-label="Refresh conversation" disabled={messages.loading} onClick={() => void refresh()}><RefreshCw size={16} /></button>
    <button className="text-button" disabled={busy} onClick={() => void status()}>{thread.status === "OPEN" ? "Close" : "Reopen"}</button></div></div>
    <div className="account-panel-body"><AccountListStatus {...messages} count={messages.rows.length} more={messages.cursor ? messages.more : undefined} />
      <div className="account-messages" aria-live="polite">{ordered.map(message => <article className={`account-message ${message.sender_role === "CUSTOMER" ? "customer" : "agent"}`} key={message.id}><small>{message.sender_role === "CUSTOMER" ? "You" : "Support"} · {new Date(message.created_at).toLocaleString()}</small><p>{message.body}</p></article>)}</div>
      {!messages.rows.length && !messages.loading && !messages.error && <EmptyState text="No messages in this conversation." />}
      {thread.status === "OPEN" ? <form className="account-form" onSubmit={send}><label>Reply<textarea rows={3} value={body} onChange={event => setBody(event.target.value)} maxLength={4000} required disabled={!accepting} /></label>
        <button className="button primary" disabled={busy || !accepting || !body.trim()}><Send size={15} />Send reply</button></form> : <p className="account-note">Reopen this conversation to send another message.</p>}
    </div>
  </section>;
}

export function AccountSupport() {
  const { onError } = useAccount();
  const [availability, setAvailability] = useState<boolean | null>(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState("");
  const [newConversation, setNewConversation] = useState(false);
  const [selected, setSelected] = useState<SupportThreadRecord | null>(null);
  const list = useAccountPage<SupportThreadRecord>("support/threads", { status: status || undefined }, onError);
  useEffect(() => {
    let active = true;
    setAvailabilityError("");
    supportAvailability().then(result => { if (active) setAvailability(result.accepting_messages); })
      .catch(failure => { if (active) { setAvailabilityError(errorMessage(failure)); onError(failure); } });
    return () => { active = false; };
  }, [onError, retry]);
  async function select(record: SupportThreadRecord) {
    try { setSelected((await getAccountSupportThread(record.id)).thread); }
    catch (failure) { onError(failure); }
  }
  return <>
    <section className="panel account-service-note"><MessageCircle size={24} /><div><h3>Your support inbox</h3><p>{availability === null ? "Checking message availability…" : availability ? "Send a message and check this inbox for replies. Support responds asynchronously." : "New messages are temporarily unavailable. You can still read your conversations."}</p>
      {availabilityError && <><p className="form-error" role="alert">{availabilityError}</p><button className="text-button" onClick={() => setRetry(value => value + 1)}>Check again</button></>}</div></section>
    <div className="account-support-grid"><section className="panel"><div className="section-header"><div><h2>Conversations</h2><p>Messages from your account.</p></div><button className="button primary" disabled={availability !== true} onClick={() => setNewConversation(true)}><Plus size={15} />New message</button></div>
      <div className="account-toolbar"><label>Status<select aria-label="Support conversation status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All conversations</option><option value="OPEN">Open</option><option value="CLOSED">Closed</option></select></label></div>
      <div className="account-thread-list">{list.rows.map(thread => <button key={thread.id} aria-pressed={selected?.id === thread.id} className={`account-thread ${selected?.id === thread.id ? "selected" : ""}`} onClick={() => void select(thread)}><b>{thread.subject}</b><small>{thread.status} · Updated {new Date(thread.updated_at).toLocaleString()}</small></button>)}</div>
      {!list.rows.length && !list.loading && !list.error && <EmptyState text="Start a conversation when you need help." />}
      <AccountListStatus {...list} count={list.rows.length} more={list.cursor ? list.more : undefined} /></section>
      {selected ? <Conversation key={selected.id} initial={selected} accepting={availability === true} changed={list.refresh} /> : <section className="panel account-panel-body"><EmptyState text="Choose a conversation to read and reply." /></section>}
    </div>
    {newConversation && <NewConversation close={() => setNewConversation(false)} created={async thread => { setSelected(thread); await list.refresh(); }} />}
  </>;
}
