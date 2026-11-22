import type { Subscription, User } from "../../lib/types";
import type { CreatePoolInput } from "./api";
import { parseMinorAmount } from "../shared/money.ts";

export interface MemberDraft { key: string; name: string; email: string; amount: string }

/** Extra minor units go to the first members in the stable, displayed order. */
export function equalShares(target: number, count: number): number[] {
  if (!Number.isSafeInteger(target) || target <= 0 || !Number.isInteger(count) || count < 2 || count > 10 || target < count) {
    throw new Error("The plan must support a positive share for each of 2–10 members.");
  }
  const base = Math.floor(target / count);
  const remainder = target % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function validatePool(input: {
  subscription: Subscription | undefined;
  name: string;
  members: MemberDraft[];
  mode: "equal" | "custom";
  host: User;
  fallback: boolean;
}): { ok: true; payload: CreatePoolInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const { subscription, members } = input;
  if (!subscription || subscription.user_id !== input.host.id || !Number.isSafeInteger(subscription.expected_amount) || subscription.expected_amount <= 0) {
    errors.subscription = "Choose an eligible subscription from your account.";
  }
  if (!input.name.trim() || input.name.trim().length > 60) errors.name = "Use a pool name of 1–60 characters.";
  if (members.length < 2 || members.length > 10) errors.members = "Add 2–10 members, including yourself.";
  let allocated: number[] = [];
  if (input.mode === "equal" && subscription) {
    try { allocated = equalShares(subscription.expected_amount, members.length); }
    catch (error) { errors.shares = error instanceof Error ? error.message : "Invalid allocation."; }
  }
  const emails = new Set<string>();
  const payloadMembers: CreatePoolInput["members"] = [];
  let total = 0n;
  for (const [index, member] of members.entries()) {
    const name = member.name.trim();
    const email = member.email.trim().toLowerCase();
    if (!name || name.length > 60) errors[`${member.key}-name`] = "Use a member name of 1–60 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors[`${member.key}-email`] = "Enter a valid email address.";
    else if (emails.has(email)) errors[`${member.key}-email`] = "This email is already in the pool.";
    emails.add(email);
    const amount = input.mode === "equal" ? allocated[index] : parseMinorAmount(member.amount);
    if (amount == null || !Number.isSafeInteger(amount) || amount <= 0 || (subscription && amount > subscription.expected_amount)) {
      errors[`${member.key}-amount`] = "Use a positive share, with up to two decimals, no greater than the plan total.";
    } else {
      total += BigInt(amount);
      payloadMembers.push({ name, email, share_amount: amount });
    }
  }
  if (!emails.has(input.host.email.trim().toLowerCase())) errors.host = "Include your account email as the pool host.";
  if (subscription && total !== BigInt(subscription.expected_amount)) errors.shares = "Shares must add up to the exact plan total.";
  if (Object.keys(errors).length || !subscription) return { ok: false, errors };
  return { ok: true, payload: { subscription_id: subscription.id, name: input.name.trim(), members: payloadMembers, fallback_enabled: input.fallback } };
}
