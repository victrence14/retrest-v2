"use client";

import type { FormEvent } from "react";
import { Shield, ShieldCheck } from "lucide-react";
import type { Currency } from "@retrest/shared";
import { DialogHeading } from "@/components/ui";
import { majorToMinor } from "@/lib/money";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { createSubscription } from "../api";

const ONE_WEEK_MS = 7 * 86_400_000;

export function AddSubscriptionDialog() {
  const { mutate, busy, formError, closeDialog } = useWorkspace();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const done = await mutate(
      () =>
        createSubscription({
          merchant_name: String(form.get("merchant_name")),
          merchant_descriptor: String(form.get("merchant_descriptor")).toUpperCase().trim(),
          expected_amount: majorToMinor(form.get("amount")),
          currency: form.get("currency") as Currency,
          next_billing_date: String(form.get("date")),
          is_business_expense: form.get("business") === "on",
        }),
      "Subscription connected and price shield activated.",
    );
    if (done) closeDialog();
  }

  return (
    <>
      <DialogHeading
        kicker={<><Shield size={16} /> BRING A BILL UNDER YOUR SHIELD</>}
        title={<>New subscription.<br />Your rules</>}
        description="Set the merchant’s limit, then use your master card at checkout."
      />
      <form onSubmit={submit}>
        <div className="form-two">
          <label>
            Merchant name
            <input name="merchant_name" placeholder="e.g. Apple Music" maxLength={60} required />
          </label>
          <label>
            Card statement descriptor
            <input name="merchant_descriptor" placeholder="e.g. APPLE MUSIC" maxLength={60} required />
          </label>
        </div>
        <div className="form-two">
          <label>
            Maximum monthly charge
            <input name="amount" type="number" min="0.01" max="1000000" step="0.01" placeholder="2,000" required />
          </label>
          <label>
            Currency
            <select name="currency">
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>
        <label>
          Next renewal
          <input name="date" type="date" defaultValue={new Date(Date.now() + ONE_WEEK_MS).toISOString().slice(0, 10)} required />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" name="business" /> This is a business expense
        </label>
        {formError && <p className="form-error">{formError}</p>}
        <button className="button primary full-width" disabled={busy}>
          <ShieldCheck size={16} /> Connect & protect
        </button>
      </form>
    </>
  );
}
