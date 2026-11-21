"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import type { Dashboard } from "../../lib/types";
import { errorMessage } from "../shared/api";
import { loadPoolState } from "./api";
import PoolEditor from "./PoolEditor";
import PoolDetail from "./PoolDetail";
import "./styles.css";

export interface PoolsPageProps { initialData: Dashboard; onStateChange?: (data: Dashboard) => void; initialSubscriptionId?: string }

export function PoolsPage({ initialData, onStateChange, initialSubscriptionId }: PoolsPageProps) {
  const [data, setData] = useState(initialData);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => { setData(initialData); }, [initialData]);
  function confirmed(state: Dashboard) { setData(state); onStateChange?.(state); }

  return <div className="fe2-pools">
    <div className="fe2-pool-page-actions"><p>{data.pools.length} shared plans · balances shown in their original currency</p><div><button type="button" className="button secondary" disabled={busy} onClick={async () => { if (lock.current) return; lock.current = true; setBusy(true); setError(""); try { confirmed(await loadPoolState()); } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); lock.current = false; } }}><RefreshCw size={14} />{busy ? "Refreshing…" : "Refresh pools"}</button><button type="button" className="button primary" onClick={() => setEditing(true)}><Plus size={15} />Create a pool</button></div></div>
    {error && <p role="alert" className="fe2-pool-error">{error}</p>}
    {editing ? <PoolEditor data={data} initialSubscriptionId={initialSubscriptionId} onCancel={() => setEditing(false)} onCreated={result => { confirmed(result.state); setEditing(false); }} /> : <div className="fe2-pool-grid">{data.pools.map(pool => <PoolDetail key={pool.id} pool={pool} demoEnabled={data.demo_enabled} onStateChange={confirmed} />)}{!data.pools.length && <div className="fe2-pool-empty"><h2>Start sharing a plan.</h2><p>Create a pool with an equal or custom allocation.</p></div>}</div>}
  </div>;
}

export default PoolsPage;
