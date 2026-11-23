"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Copy, Plus, Settings2, Users } from "lucide-react";
import { money, type CreatePoolMember } from "@retrest/shared";
import { DialogHeading, EmptyState } from "@/components/ui";
import { majorToMinor } from "@/lib/money";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { hasPool } from "@/features/workspace/selectors";
import { createPool } from "../api";
import { inviteUrl } from "../invite-link";
import { equalShares } from "../shares";

const MEMBER_COUNTS = [2, 3, 4, 5, 6];
type SplitMode = "equal" | "custom";

/** Create a split pool for a subscription, then share its invite link. */
export function CreatePoolDialog({ subscriptionId }: { subscriptionId?: string }) {
  const { data, busy, formError, mutate, notify, copy, closeDialog } = useWorkspace();
  const router = useRouter();
  const eligible = data.subscriptions.filter((s) => !hasPool(data, s.id));
  const [selectedId, setSelectedId] = useState(subscriptionId ?? "");
  const [memberCount, setMemberCount] = useState(3);
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [link, setLink] = useState("");
  const subscription = eligible.find((s) => s.id === selectedId) ?? eligible[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subscription) return;
    const form = new FormData(event.currentTarget);
    let shares: number[];
    try {
      shares =
        splitMode === "equal"
          ? equalShares(subscription.expected_amount, memberCount)
          : Array.from({ length: memberCount }, (_, i) => majorToMinor(form.get(`share_${i}`)));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Invalid allocation.", true);
      return;
    }
    // Member 0 is always the host (you); the rest come from the form.
    const members: CreatePoolMember[] = shares.map((share_amount, i) => ({
      name: i === 0 ? data.user.name : String(form.get(`name_${i}`)),
      email: i === 0 ? data.user.email : String(form.get(`email_${i}`)),
      share_amount,
    }));
    const result = await mutate(
      () =>
        createPool({
          subscription_id: subscription.id,
          name: String(form.get("pool_name")),
          members,
          fallback_enabled: form.get("fallback") === "on",
        }),
      "Your pool is ready to share.",
    );
    if (result) setLink(inviteUrl(result.invite_token));
  }

  return (
    <>
      <DialogHeading kicker={<><Users size={16} /> MAKE IT A GROUP THING</>} title={<>Same subscription.<br />Smaller share</>} />
      {link ? (
        <div className="pool-created">
          <span className="success-circle">
            <Check size={30} />
          </span>
          <h3>Your pool is ready.</h3>
          <p>Share this link with your people. Contributions are collected before the next renewal.</p>
          <div className="invite-link-text">{link}</div>
          <button className="button primary full-width" onClick={() => copy(link)}>
            <Copy size={15} /> Copy invite link
          </button>
          <button
            className="text-button"
            onClick={() => {
              closeDialog();
              router.push("/pools?demo=1");
            }}
          >
            See your pool <ArrowRight size={15} />
          </button>
        </div>
      ) : !subscription ? (
        <EmptyState text="All your subscriptions already have pools. Add a subscription to create another." />
      ) : (
        <form onSubmit={submit}>
          <label>
            Choose a subscription
            <select value={subscription.id} onChange={(e) => setSelectedId(e.target.value)}>
              {eligible.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.merchant_name} · {money(s.expected_amount, s.currency)}/month
                </option>
              ))}
            </select>
          </label>
          <label>
            Give your pool a name
            <input name="pool_name" placeholder="e.g. The listening lounge" maxLength={60} required />
          </label>
          <div className="form-two">
            <label>
              Members, including you
              <select value={memberCount} onChange={(e) => setMemberCount(Number(e.target.value))}>
                {MEMBER_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n} members
                  </option>
                ))}
              </select>
            </label>
            <label>
              How to split
              <select value={splitMode} onChange={(e) => setSplitMode(e.target.value as SplitMode)}>
                <option value="equal">Equal shares</option>
                <option value="custom">Custom shares</option>
              </select>
            </label>
          </div>
          <div className="split-preview">
            {splitMode === "equal" ? (
              <>
                <Users size={16} />
                <span>
                  About <b>{money(Math.floor(subscription.expected_amount / memberCount), subscription.currency)}</b> each, per month
                </span>
              </>
            ) : (
              <>
                <Settings2 size={16} />
                <span>
                  Custom shares must total <b>{money(subscription.expected_amount, subscription.currency)}</b>
                </span>
              </>
            )}
          </div>
          <div className="pool-form-members">
            {Array.from({ length: memberCount }, (_, i) => (
              <div className="pool-form-member" key={i}>
                <span>{i + 1}</span>
                {i === 0 ? (
                  <b>{data.user.name} (you)</b>
                ) : (
                  <>
                    <input name={`name_${i}`} aria-label={`Member ${i + 1} name`} placeholder="Friend’s name" required />
                    <input type="email" name={`email_${i}`} aria-label={`Member ${i + 1} email`} placeholder="Email address" required />
                  </>
                )}
                {splitMode === "custom" && (
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    name={`share_${i}`}
                    aria-label={`Member ${i + 1} share`}
                    placeholder="Share"
                    required
                  />
                )}
              </div>
            ))}
          </div>
          <label className="checkbox-label">
            <input type="checkbox" name="fallback" defaultChecked /> Cover shortfalls from my wallet at renewal
          </label>
          {formError && <p className="form-error">{formError}</p>}
          <button className="button primary full-width" disabled={busy}>
            <Plus size={16} /> Create pool & get invite link
          </button>
        </form>
      )}
    </>
  );
}
