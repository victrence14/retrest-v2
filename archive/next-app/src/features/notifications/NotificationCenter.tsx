"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bell, RefreshCw } from "lucide-react";
import type { Dashboard } from "../../lib/types";
import { errorMessage, isAbort } from "../shared/api";
import { loadNotifications, notificationCapabilities, recentUnreadCount } from "./api";
import "./styles.css";

export interface NotificationCenterProps {
  initialData: Dashboard;
  /** Opens FE1's existing subscription review UI; must never authorize or replay a charge. */
  onReviewSubscription: (id: string) => void;
  onOpenTransaction?: (id: string) => void;
  onUnreadCountChange?: (recentUnreadCount: number) => void;
  onStateChange?: (data: Dashboard) => void;
  enabled?: boolean;
}

export function NotificationCenter({ initialData, onReviewSubscription, onOpenTransaction, onUnreadCountChange, onStateChange, enabled = true }: NotificationCenterProps) {
  const [data, setData] = useState(initialData);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  const callbacks = useRef({ onStateChange, onUnreadCountChange });
  useEffect(() => { callbacks.current = { onStateChange, onUnreadCountChange }; }, [onStateChange, onUnreadCountChange]);
  useEffect(() => { setData(initialData); }, [initialData]);
  const refresh = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; setLoading(true);
    const controller = new AbortController(); request.current = controller;
    try { const confirmed = await loadNotifications(controller.signal); if (!controller.signal.aborted) { setData(confirmed); setError(""); callbacks.current.onStateChange?.(confirmed); } }
    catch (error) { if (!isAbort(error)) setError(errorMessage(error)); }
    finally { lock.current = false; if (!controller.signal.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    function tick() { if (document.visibilityState === "visible") void refresh(); }
    tick();
    const timer = setInterval(tick, notificationCapabilities.pollingIntervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); request.current?.abort(); };
  }, [enabled, refresh]);
  const unread = recentUnreadCount(data.notifications);
  useEffect(() => { callbacks.current.onUnreadCountChange?.(unread); }, [unread]);
  const shown = data.notifications.filter(notification => !onlyUnread || !notification.read_at);

  return <section className="fe2-notifications" aria-label="Notification centre">
    <div className="fe2-notifications-heading"><div><span className="eyebrow"><Bell size={15} />YOUR SHIELD HAS AN UPDATE</span><h2>Always in the loop.</h2><p><b>{unread}</b> unread in the latest 30 notifications.</p></div><button type="button" className="icon-button" aria-label="Refresh notifications" disabled={loading} onClick={refresh}><RefreshCw size={17} /></button></div>
    <label className="fe2-notifications-filter"><input type="checkbox" checked={onlyUnread} onChange={event => setOnlyUnread(event.target.checked)} />Show unread only</label>
    {error && <p role="alert" className="fe2-notifications-error">{error} Use refresh to retry.</p>}
    <div className="fe2-notifications-list">{shown.map(notification => {
      const subscription = data.subscriptions.find(item => item.id === notification.subscription_id);
      return <article key={notification.id} className="fe2-notification" data-read={!!notification.read_at}>
        <Bell size={18} /><div><div className="fe2-notification-title"><h3>{notification.title}</h3><span>{notification.read_at ? "Read" : "Unread"}</span></div><p>{notification.message}</p><div className="fe2-notification-actions">{subscription && <button type="button" className="button secondary" onClick={() => onReviewSubscription(subscription.id)}>Review {subscription.merchant_name}<ArrowUpRight size={13} /></button>}{notification.transaction_id && (onOpenTransaction ? <button type="button" className="text-button" onClick={() => onOpenTransaction(notification.transaction_id!)}>Open payment details<ArrowUpRight size={13} /></button> : <Link href="/transactions" className="text-button">Open transactions<ArrowUpRight size={13} /></Link>)}</div></div>
      </article>;
    })}</div>
    {!shown.length && <p className="fe2-notifications-note">No notifications in this view.</p>}
    <p className="fe2-notifications-note">Updates refresh every three seconds while this centre is open. Read markers come from the server; a separate mark-as-read action is not connected yet. Reviewing a subscription does not replay a declined payment.</p>
  </section>;
}

export default NotificationCenter;
