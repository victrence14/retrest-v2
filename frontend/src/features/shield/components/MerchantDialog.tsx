"use client";

import type { FormEvent } from "react";
import { Check, Pause, Play, ShieldCheck, Users } from "lucide-react";
import { money, shortDate, type Subscription } from "@retrest/shared";
import { MerchantLogo } from "@/components/ui";
import { majorToMinor } from "@/lib/money";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { hasPool } from "@/features/workspace/selectors";
import { setMerchantLimit } from "../api";

/** One merchant's rules: price limit, pool split, and kill switch. */
export function MerchantDialog({ merchant }: { merchant: Subscription }) {
  const { data, mutate, busy, formError, openDialog, closeDialog, toggleSubscription } = useWorkspace();
  const pooled = hasPool(data, merchant.id);

  async function saveLimit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const done = await mutate(
      () => setMerchantLimit(merchant.id, majorToMinor(form.get("maximum"))),
      "Merchant limit saved. Your price shield is updated.",
    );
    if (done) closeDialog();
  }

  async function toggleKillSwitch() {
    await toggleSubscription(data.subscriptions.find((s) => s.id === merchant.id) ?? merchant);
    closeDialog();
  }

  return (
    <>
      <div className="merchant-modal-top">
        <MerchantLogo name={merchant.merchant_name} />
        <span className={`badge ${merchant.status === "ACTIVE" ? "green" : "neutral"}`}>
          {merchant.status === "ACTIVE" ? "Protected" : "Kill switch active"}
        </span>
      </div>
      <h2>
        {merchant.merchant_name}
        <span>.</span>
      </h2>
      <p className="modal-description">
        {merchant.plan_name} · {merchant.merchant_descriptor}
      </p>
      <form onSubmit={saveLimit}>
        <div className="merchant-info">
          <span>
            Next renewal<b>{shortDate(merchant.next_billing_date)}</b>
          </span>
          <span>
            Expected charge<b>{money(merchant.expected_amount, merchant.currency)}</b>
          </span>
        </div>
        <label>
          Maximum allowed charge ({merchant.currency})
          <input
            type="number"
            name="maximum"
            step="0.01"
            min={merchant.expected_amount / 100}
            defaultValue={merchant.expected_max_amount / 100}
            required
          />
        </label>
        <div className="form-callout">
          <ShieldCheck size={17} />
          <span>Any charge above this amount is declined before money leaves your wallet.</span>
        </div>
        {formError && <p className="form-error">{formError}</p>}
        <button className="button primary full-width" disabled={busy}>
          Save merchant rule <Check size={16} />
        </button>
      </form>
      <button
        className="button secondary full-width"
        onClick={() => openDialog({ kind: "create-pool", subscriptionId: merchant.id })}
        disabled={pooled}
      >
        <Users size={15} />
        {pooled ? "Shared pool connected" : "Split this subscription"}
      </button>
      <button className="button secondary full-width merchant-pause" disabled={busy} onClick={toggleKillSwitch}>
        {merchant.status === "ACTIVE" ? (
          <>
            <Pause size={15} /> Activate kill switch
          </>
        ) : (
          <>
            <Play size={15} /> Resume subscription
          </>
        )}
      </button>
    </>
  );
}
