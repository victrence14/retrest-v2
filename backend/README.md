# RETREST backend

Express 5 + TypeScript, with PostgreSQL/Supabase for account features and an independent SQLite payment demo.

| Capability | Implementation |
| --- | --- |
| Authentication | Supabase signup, email-link/code confirmation, login, refresh, recovery, password/email changes and logout |
| Account data | Owner-scoped subscriptions, pools, verified invitations, contributions and transaction history |
| Reports | Complete period aggregates, streamed CSV, printable HTML and paginated PDF receipts |
| Preferences | Persistent phone, time zone, theme, Auto-FX and email preferences |
| Devices | Opaque, hashed trust tokens tied to a verified Auth session; removal revokes that session in API checks and RLS |
| Notifications | Complete pagination, unread counts and idempotent read actions |
| Support | Persistent asynchronous customer/staff inbox with authenticated staff replies |
| Monthly email | Immutable summaries, durable outbox, Resend worker, retries, leases and signed delivery events |
| Operations | Validated configuration, request IDs, readiness/liveness, graceful shutdown, Docker and CI |

**Start with [API contracts](./docs/API.md), [architecture](./docs/ARCHITECTURE.md), and [deployment and recovery](./docs/DEPLOYMENT.md).**

## Local demo

From the repository root, using Node **22.18+**:

```sh
npm --prefix backend ci
cp backend/.env.example backend/.env
npm --prefix backend run dev
```

The demo runs on http://localhost:3001, creates its database once, and preserves existing state on subsequent starts. The frontend proxies requests to it. Root `npm run dev` starts both apps.

Demo routes use a signed HttpOnly cookie issued by `POST /api/session`. Funding, issuer decisions, pool contributions and FX in this workspace are simulations. The demo identity is never used by `/api/v1`.

## Account API

1. Create a dedicated Supabase project, or use local Supabase as described in [deployment](./docs/DEPLOYMENT.md).
2. Apply **all** [migrations](./supabase/migrations/) in filename order and the repeatable reference-data [seed](./supabase/seed.sql).
3. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and the Auth redirect URLs in the backend environment.
4. Enable email confirmation, a 12-character minimum password and confirmation at both addresses for email changes in Supabase Auth.
5. Start the API and call `/api/auth/*`, then pass the returned access token as `Authorization: Bearer …` to `/api/v1/*`.

Passwords and refresh tokens belong to Supabase Auth and are never stored in application tables. Every protected account request verifies its identity with Supabase, checks persistent session revocation and uses that user's JWT for PostgreSQL RLS.

With account configuration absent, account/auth routes return 503 and the local demo still works. Production defaults disable the demo and require Supabase configuration. Set `RETREST_DEMO_ENABLED=false` explicitly for account deployments.

The frontend connects its auth forms and account workspace to these APIs through same-origin route handlers and HttpOnly session cookies. The SQLite demo remains available at workspace routes with `?demo=1`. Add `{{ .Token }}` to Supabase's signup and recovery email templates to offer code entry alongside verification links; see [authentication guidance](./docs/API.md#authentication).

## Support staff

Support is a real, persisted asynchronous inbox. A deployed staff interface can list `GET /api/v1/support/inbox` and reply using the same thread/message APIs. A trusted administrator assigns staff membership:

```sql
insert into public.support_agents(user_id) values ('VERIFIED_AGENT_AUTH_UUID')
on conflict(user_id) do update set disabled_at = null;
```

Customers cannot assign that role or claim to be an agent in a message. Set `SUPPORT_ENABLED=false` to stop new messages while retaining conversation history.

## Email and settlement adapters

For monthly emails, configure `EMAIL_PROVIDER=resend`, a verified `EMAIL_FROM`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`. Start the separate worker:

```sh
npm --prefix backend run worker:email
# Alternatively, process one bounded batch:
npm --prefix backend run worker:email:once
```

The worker also queues the last completed UTC month's summary for verified accounts with `monthly_summary_email=true`, once per account/month. Apply [the scheduling migration](./supabase/migrations/20261123000000_scheduled_summaries.sql) first. Set `MONTHLY_EMAIL_SCHEDULING_ENABLED=false` to pause automatic queuing. Opt-out cancels automatic jobs before another attempt; explicit on-demand emails remain available. Register Resend's delivery webhook at `/api/webhooks/email`. HTTP acceptance remains `ACCEPTED` until a verified provider event confirms delivery.

Provider adapters must implement the signed [payment/contribution settlement contracts](./docs/API.md#trusted-provider-webhooks). A contribution API call records a `PENDING` request. It does not call a bank or payment provider or debit a wallet. Only a matching trusted confirmation can settle it and credit its pool. The PostgreSQL feature APIs do not replace the existing simulated SQLite authorization engine with a live issuer integration.

The service-role key is confined to these trusted webhooks and workers. Ordinary account routes use the user JWT.

## Tests and checks

```sh
npm --prefix backend run typecheck
npm --prefix backend test
npm --prefix backend run test:database
npm --prefix backend run test:http
# Whole repository:
npm run typecheck
npm test
npm run build
```

The default frontend build uses webpack to avoid the installed Turbopack/PostCSS ES-module incompatibility. Run `npm run build` normally. The root `npm run test:ui` builds an isolated frontend and verifies actual Next/Express account sessions alongside desktop/mobile UI journeys.

Unit and API tests use in-memory SQLite and PostgreSQL via PGlite. They execute the committed migrations, table privileges and RLS under real PostgreSQL roles. Auth and outbound provider transports are stubbed; tests need no Supabase account, live keys or network.

Coverage includes two-user isolation, unconfirmed/expired/spoofed identity, provider outages, exact shares, invite expiry/revocation, settlement transitions, duplicate events, session/device revocation, support roles, notification reads, 1,000+ transaction pagination with microsecond ties, aggregate/CSV reconciliation, receipt eligibility, PDF limits, SQLite restart persistence and email worker recovery.

`test:http` starts and shuts down its own in-memory demo. `test:http:remote` is for a disposable server or frontend proxy; it refuses to mutate a server unless health confirms `NODE_ENV=test`, `DATABASE_PATH=:memory:` and enabled demo mode.

[CI](../.github/workflows/backend.yml) installs locked dependencies, checks types, runs database/API/service/smoke tests and builds the deployment image.
