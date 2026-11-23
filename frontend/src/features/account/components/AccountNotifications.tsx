"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import type { AccountNotification } from "@retrest/shared";
import { DialogFrame, EmptyState } from "@/components/ui";
import { markAccountNotificationsRead } from "../api";
import { useAccount } from "../AccountContext";
import { useAccountPage } from "../useAccountPage";
import { AccountListStatus } from "./AccountListStatus";

const destinations = { subscription: "/shield", transaction: "/transactions", pool: "/pools", support: "/support", summary: "/insights" };
export function AccountNotifications({ close, changed, unread }: { close: () => void; changed: () => Promise<void>; unread: number }) {
  const { busy, run, onError } = useAccount();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const list = useAccountPage<AccountNotification>("notifications", { unread: onlyUnread || undefined }, onError);
  async function mark(ids?: string[]) {
    const result = await run(() => markAccountNotificationsRead(ids ? { ids } : { all: true }), "Notifications marked as read.");
    if (result) await Promise.all([list.refresh(), changed()]);
  }
  return <DialogFrame label="Notifications" drawer className="account-notifications" busy={busy} onClose={close}>
    <div className="account-dialog-heading"><span className="eyebrow">YOUR UPDATES</span><h2><Bell size={20} />Notifications</h2><p>{unread} unread across your account.</p></div>
    <div className="account-actions"><label className="checkbox-label"><input type="checkbox" checked={onlyUnread} onChange={event => setOnlyUnread(event.target.checked)} />Only unread</label>
      <button className="text-button" disabled={busy || unread === 0} onClick={() => void mark()}><CheckCheck size={15} />Mark all read</button></div>
    <div className="account-notification-list">{list.rows.map(record => <article className={`account-notification ${record.read_at ? "" : "unread"}`} key={record.id}><h3>{record.title}</h3><p>{record.message}</p><small>{new Date(record.created_at).toLocaleString()}</small>
      <div className="account-actions">{!record.read_at && <button className="text-button" disabled={busy} onClick={() => void mark([record.id])}>Mark read</button>}
        {record.resource_type && <Link href={destinations[record.resource_type]} className="text-button" onClick={close}>Open {record.resource_type} →</Link>}</div></article>)}</div>
    {!list.rows.length && !list.loading && !list.error && <EmptyState text={onlyUnread ? "You’re all caught up." : "No notifications yet."} />}
    <AccountListStatus {...list} count={list.rows.length} more={list.cursor ? list.more : undefined} />
  </DialogFrame>;
}
