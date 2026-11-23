# Frontend API integration and remaining live setup

Updated 23 November 2026 after the integration audit. The frontend now uses real account API contracts. Normal workspace routes require an account; [the demo](../../frontend/src/features/workspace/WorkspacePage.tsx) is explicit through `?demo=1`.

## Implemented and verified

- [Auth forms](../../frontend/src/features/auth/components/AuthScreen.tsx) call signup, login, verification, recovery, password/email changes, logout and device registration. New passwords require 12 characters.
- [Next Route Handlers](../../frontend/src/lib/api/account-proxy.ts) hold access, refresh and device credentials in HttpOnly cookies, refresh expired sessions and supply Express bearer headers. Browser JSON does not receive those credentials.
- [Routing](../../frontend/next.config.ts) runs the account/auth handlers before the fallback Express rewrite.
- [Account screens](../../frontend/src/features/account/components/) use paginated subscriptions, pools/invites/contributions, transactions, complete insights, authenticated downloads, settings, notifications and persisted support.
- Light/dark/device appearance and shared dismissible notifications work across auth, account, demo and invitation pages. Mobile notifications clear the navigation.
- The default frontend build uses webpack, the verified path for the installed Next/Tailwind tooling.
- [Frontend CI](../../.github/workflows/frontend.yml) installs locked dependencies and runs unit tests plus an isolated production build and browser integration suite.

The earlier preview-auth, missing DELETE/idempotency support, demo-only loading and poisoned demo-session retry findings are resolved in code.

## Run and consume account APIs

Use Node 22.18+ and npm 10+. Install app dependencies with `npm run install:all`. Configure [the backend environment](../.env.example) and set the frontend's server-only `API_URL` to Express. Then run `npm run dev`.

Browser requests use same-origin paths. Use the existing account helpers; do not store bearer tokens in browser storage:

```ts
import { login } from "@/features/auth/api";
import { getAccountUser, accountPage } from "@/features/account/api";

await login(email, password);
const { user } = await getAccountUser();
const subscriptions = await accountPage("subscriptions", { limit: 50 });
// The Next handlers supply the bearer token from HttpOnly cookies.
```

Direct clients outside this Next frontend use the [Express bearer contract](./API.md). Account records use integer minor units; aggregate amounts are exact strings. Keep NGN/USD separate. Follow `next_cursor` with unchanged filters. Preserve idempotency keys on retries of contributions, support messages and explicit summary emails.

Check both `/api/health` and `/api/ready`. Health alone does not verify Supabase migrations.

## Supabase and email confirmation

Apply all [migrations](../supabase/migrations/) in order and [seed categories](../supabase/seed.sql). Existing projects that already applied the first four migrations need only [the scheduling migration](../supabase/migrations/20261123000000_scheduled_summaries.sql). The [complete schema](../supabase/schema.sql) is for a NEW project; do not replay it against existing tables.

Set backend `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `AUTH_REDIRECT_URL` and `AUTH_RECOVERY_REDIRECT_URL`. In Supabase Authentication, enable email confirmation, 12-character minimum passwords, secure email changes and the allowed callback URLs. Include `{{ .Token }}` in signup/recovery templates for code entry. See [Auth details](./API.md#authentication).

A phone cannot reach the laptop through `localhost`. Open local email links on the laptop while the app runs. For phone access, use a deployed HTTPS URL or development tunnel; set the corresponding backend redirects, frontend `APP_ORIGIN`, CORS origins and Supabase Site URL/redirect allow-list before requesting a fresh email. If Supabase already confirmed the address before the redirect failed, try login first.

No public production URL is configured in this checkout. Hosted confirmation, SMTP delivery and real account credentials still need an operator rehearsal.

## Summary delivery

Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, verified `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET` and the backend-only `SUPABASE_SERVICE_ROLE_KEY`. Register `/api/webhooks/email` with Resend and run `npm --prefix backend run worker:email`.

The worker queues the last completed UTC month's immutable summary for each verified account with `monthly_summary_email=true`. Batches are bounded and repeated workers do not duplicate monthly jobs. Opt-out cancels automatic jobs before another attempt. Manual email requests remain available. Set `MONTHLY_EMAIL_SCHEDULING_ENABLED=false` to suspend automatic queuing.

These credentials remain absent locally, so actual delivery is disabled. Offline tests verify scheduling, exact totals, idempotency, opt-out, leases, retries and signed delivery events; they do not claim a message reached a real inbox.

## Real payments

The backend validates signed settlement/contribution events, but card issuance/reveal, bank funding, FX execution and payment initiation still need the selected provider's contracts and credentials. Set `SETTLEMENT_WEBHOOK_SECRET` only when a trusted adapter is connected. A contribution request remains `PENDING` until matching trusted confirmation; it never simulates a real bank debit.

## Verification commands

```sh
npm run typecheck
npm test
npm run build
npm run test:ui
```

The root browser command builds a private frontend snapshot and starts disposable SQLite/PGlite-backed Express and production Next servers. It leaves the current dev servers and hosted databases alone. All 27 browser checks passed after the routing/toast changes, including actual Next cookie handling, refresh, confirmation/recovery, SQL session revocation, two-account isolation, pool invitations, support and authenticated exports. UI-only fixtures remain for detailed appearance/error checks.

For an already running disposable test environment, `npm --prefix frontend run test:ui` accepts `TEST_ORIGIN`. Managed account integration checks run through the root command. CI executes the same root command without live keys.

Live Supabase signup/OTP email receipt, SMTP/Resend delivery, provider onboarding and hosted rollout require the selected public URL, real operator credentials and provider setup.
