import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "../config.ts";
import { databaseResult } from "../lib/database-result.ts";
import { currency, month } from "../lib/feature-validation.ts";
import { escapeHtml, minorDecimal } from "./documents.ts";

const jobSchema = z.object({
  id: z.uuid(), claim_token: z.uuid(), recipient: z.email(),
  payload: z.object({ month, totals: z.array(z.object({
    currency, settled_amount_minor: z.string().regex(/^\d+$/), settled_count: z.number().int().nonnegative(),
  })) }),
});
export class EmailProviderError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) { super(code); }
}
export interface EmailProvider {
  send(input: { id: string; to: string; subject: string; html: string }): Promise<string>;
}
/** The service-role scheduler only queues opted-in accounts; delivery uses the existing outbox. */
export async function scheduleMonthlyEmails(admin: SupabaseClient) {
  return databaseResult<number>(await admin.rpc("schedule_monthly_summary_emails", { p_limit: 100 }));
}
export function createResendProvider(config: NonNullable<Config["email"]>, transport: typeof fetch = fetch): EmailProvider {
  return {
    async send(input) {
      let response: Response;
      try {
        response = await transport("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json",
            "Idempotency-Key": `retrest-email-${input.id}` },
          body: JSON.stringify({ from: config.from, to: [input.to], subject: input.subject, html: input.html }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch { throw new EmailProviderError("provider_unreachable", true); }
      if (!response.ok) throw new EmailProviderError("provider_rejected", response.status === 429 || response.status >= 500);
      try {
        const result = z.object({ id: z.string().min(1).max(200) }).parse(await response.json());
        return result.id;
      } catch { throw new EmailProviderError("invalid_provider_response", true); }
    },
  };
}
/** Claims and processes a bounded batch; multiple worker processes may run concurrently. */
export async function runEmailBatch(admin: SupabaseClient, provider: EmailProvider) {
  const jobs = databaseResult<unknown[]>(await admin.rpc("claim_email_jobs", { p_limit: 4, p_lease_seconds: 120 }));
  const results = await Promise.allSettled(jobs.map(async value => {
    const parsed = jobSchema.safeParse(value);
    // Even a corrupt payload must release its lease and become a permanent failure.
    const identity = z.object({ id: z.uuid(), claim_token: z.uuid() }).parse(value);
    let providerId: string | null = null;
    let errorCode: string | null = null;
    let retryable = false;
    if (parsed.success) {
      const job = parsed.data;
      try {
        providerId = await provider.send({
          id: job.id, to: job.recipient, subject: `Your RETREST summary for ${job.payload.month}`,
          html: `<h1>RETREST monthly summary</h1><p>Statement month (UTC): ${escapeHtml(job.payload.month)}</p><ul>${
            job.payload.totals.map(total => `<li>${escapeHtml(total.currency)} ${minorDecimal(total.settled_amount_minor)} across ${total.settled_count} settled payments</li>`).join("")
          }</ul><p>This is a snapshot of confirmed payments. Sign in to RETREST for current transactions and receipts.</p>`,
        });
      } catch (error) {
        errorCode = error instanceof EmailProviderError ? error.code : "provider_unreachable";
        retryable = error instanceof EmailProviderError ? error.retryable : true;
      }
    } else errorCode = "invalid_job_payload";
    const finished = databaseResult<boolean>(await admin.rpc("finish_email_job", {
      p_job_id: identity.id, p_claim_token: identity.claim_token, p_provider_message_id: providerId,
      p_error_code: errorCode, p_retryable: retryable,
    }));
    return { finished, accepted: providerId !== null };
  }));
  const outcomes = results.map(result => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
  return { claimed: jobs.length, finished: outcomes.filter(value => value.finished).length, accepted: outcomes.filter(value => value.finished && value.accepted).length };
}
