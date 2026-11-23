import { config as loadEnv } from "dotenv";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { BACKEND_ROOT, readConfig } from "../config.ts";
import { createAdminClient } from "../lib/supabase.ts";
import { createResendProvider, runEmailBatch, scheduleMonthlyEmails } from "../services/email.ts";

loadEnv({ path: join(BACKEND_ROOT, ".env"), quiet: true });
const controller = new AbortController();
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { stopping = true; controller.abort(); });
try {
  const config = readConfig(process.env);
  if (!config.supabase || !config.email) throw new Error("Configure Supabase service-role access and EMAIL_PROVIDER=resend before starting the email worker.");
  const admin = createAdminClient(config.supabase);
  const provider = createResendProvider(config.email);
  let nextSchedule = 0;
  do {
    try {
      if (config.monthlyEmailSchedulingEnabled !== false && Date.now() >= nextSchedule) {
        const queued = await scheduleMonthlyEmails(admin);
        console.log(JSON.stringify({ event: "monthly_email_schedule", queued }));
        // Keep draining bounded batches before sleeping for a minute.
        nextSchedule = queued < 100 ? Date.now() + 60_000 : 0;
      }
      console.log(JSON.stringify({ event: "email_batch", ...await runEmailBatch(admin, provider) }));
    } catch {
      console.error(JSON.stringify({ event: "email_batch_error" }));
      if (process.argv.includes("--once")) { process.exitCode = 1; break; }
    }
    if (process.argv.includes("--once") || stopping) break;
    await setTimeout(2000, undefined, { signal: controller.signal }).catch(() => {});
  } while (!stopping);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to start the email worker.");
  process.exitCode = 1;
}
