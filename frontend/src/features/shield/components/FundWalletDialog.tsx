"use client";

import type { FormEvent } from "react";
import { LoaderCircle, Plus, ShieldCheck, Wallet } from "lucide-react";
import type { Currency } from "@retrest/shared";
import { DialogHeading } from "@/components/ui";
import { majorToMinor } from "@/lib/money";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { fundWallet } from "../api";

export function FundWalletDialog() {
  const { mutate, busy, formError, closeDialog } = useWorkspace();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currency = form.get("currency") as Currency;
    const done = await mutate(() => fundWallet(currency, majorToMinor(form.get("amount"))), "Demo wallet funded. You’re good to go.");
    if (done) closeDialog();
  }

  return (
    <>
      <DialogHeading
        kicker={<><Wallet size={16} /> TOP UP & TAKE A BREATH</>}
        title={<>A little more<br />in your wallet</>}
        description="Add demo funds to your NGN or USD wallet."
      />
      <form onSubmit={submit}>
        <label>
          Currency
          <select name="currency" defaultValue="NGN">
            <option value="NGN">NGN — Nigerian naira</option>
            <option value="USD">USD — US dollar</option>
          </select>
        </label>
        <label>
          Amount
          <input name="amount" type="number" min="0.01" max="1000000" step="0.01" defaultValue="25000" required />
        </label>
        <div className="form-callout">
          <ShieldCheck size={17} />
          <span>Demo funding is instant. Real bank transfers require a connected payment provider.</span>
        </div>
        {formError && <p className="form-error">{formError}</p>}
        <button className="button primary full-width" disabled={busy}>
          {busy ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />} Add funds
        </button>
      </form>
    </>
  );
}
