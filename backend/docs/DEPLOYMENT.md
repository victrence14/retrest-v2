# Deployment, migrations and recovery

## Requirements and local checks

Use Node 22.18+ and npm 10+. Account features need a Supabase/PostgreSQL project. Docker is required for containers and local Supabase. The backend lockfile pins dependencies.

The Supabase CLI is included in the backend's development dependencies. After installing dependencies, run `npx supabase` from the [backend folder](../), rather than relying on a global CLI installation. Use the real project reference from your Supabase URL in place of `YOUR_PROJECT_REF`.

From the repository root:

```sh
npm --prefix backend ci
npm --prefix backend run typecheck
npm --prefix backend test
npm --prefix backend run test:http
```

Unit/API tests create private in-memory databases. The smoke runner starts and shuts down its own in-memory demo; it does not need an existing server or environment file.

For production verification, the default frontend build uses webpack because the installed Turbopack/PostCSS tooling rejects the `magic-string` ES module:

```sh
npm run build
npm run test:ui
```

The browser command builds a private frontend snapshot, starts disposable Express/PostgreSQL/SQLite fixtures and checks actual Next account cookies. It does not restart the development servers or contact hosted Auth. Install Chromium first with `npm --prefix frontend exec playwright install chromium`.

For a browser/proxy rehearsal:

```sh
NODE_ENV=test DATABASE_PATH=:memory: RETREST_DEMO_ENABLED=true npm --prefix backend run dev
# Run the frontend separately in its ordinary development environment.
npm --prefix frontend run dev
# Test that disposable backend through the frontend proxy.
TEST_ORIGIN=http://localhost:3000 npm --prefix backend run test:http:remote
```

Configure the demo webhook secret first. Remote smoke tests verify the test-instance health marker before mutation. Browser reset tests must target disposable data too.

## Local Supabase

Use a dedicated disposable local project:

```sh
cd backend
npx supabase start
# Applies migrations/reference seeds to the disposable local database.
npx supabase db reset --local
npx supabase status
```

Copy the local URL/anon key into the backend environment. Copy the service-role key only for trusted webhook/worker tests. [Local configuration](../supabase/config.toml) uses frontend port 3000, email confirmation and 12-character passwords. The local email viewer can inspect confirmation/recovery links without delivering real mail.

[Offline database tests](../tests/database.test.ts) execute every migration, seed and role/RLS check. The plain SQL [RLS checks](../supabase/tests/rls.sql) can also run with `psql -v ON_ERROR_STOP=1` against a disposable migrated database; fixtures roll back.

## Hosted migrations

Keep development, staging and production in separate projects. Apply migrations before deploying code that requires them:

```sh
cd backend
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Run the repeatable [reference seed](../supabase/seed.sql) through the project's SQL editor or a trusted database connection. It seeds categories, not demo users or financial records.

Migration order:

1. `20261119000000_initial.sql`: profiles/categories/subscriptions.
2. `20261122000000_account_features.sql`: settings, sessions/devices, pools, invites, contributions, transactions and notifications.
3. `20261122010000_support_and_summaries.sql`: staff inbox, messages and summaries.
4. `20261122020000_email_outbox.sql`: email queue/events, claims and readiness.
5. `20261123000000_scheduled_summaries.sql`: privileged monthly scheduling, opted-in queuing and cancellation.

For a new project through the Supabase dashboard, open the [complete SQL schema](../supabase/schema.sql), copy it into **SQL Editor → New query**, and run it once. It combines all five migrations and the seed. An existing project that already applied the first four needs only [the scheduling migration](../supabase/migrations/20261123000000_scheduled_summaries.sql). Do not rerun the full export against existing tables. Supabase Authentication settings are configured separately.

SQL Editor execution does not register CLI migration history. Record only versions actually applied before using the CLI. After successfully applying the current full export, log in and link the same project, then run:

```sh
npx supabase migration repair --remote --status applied \
  20261119000000 20261122000000 20261122010000 20261122020000 20261123000000
```

This command records versions without executing their SQL. Use it only after successfully applying the complete export to that linked project.

Never edit an already-deployed migration; add a new one. New files build on the original schema and backfill settings for existing accounts. Check historical subscription amounts against the new safe-range/maximum constraints before migration.

Hosted Auth must enable email confirmation, a 12-character minimum password and confirmation at both addresses for email changes. Configure site/redirect URLs and Supabase SMTP for actual signup/recovery messages. Monthly summary delivery uses the separate Resend worker.

## Production environment

Start from [the environment example](../.env.example):

```dotenv
NODE_ENV=production
PORT=3001
RETREST_DEMO_ENABLED=false
CORS_ORIGINS=https://app.example.com
TRUST_PROXY=false
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PROJECT_ANON_OR_PUBLISHABLE_KEY
AUTH_REDIRECT_URL=https://app.example.com/login
AUTH_RECOVERY_REDIRECT_URL=https://app.example.com/reset-password
SUPPORT_ENABLED=true
```

Use the actual callback routes of the consuming frontend. RETREST uses `/login` for confirmation and `/reset-password` for recovery; allow-list both addresses in Supabase Auth. Email confirmation, the password policy, and secure email changes are configured separately in the Supabase dashboard.

Trusted payment adapters also need a random 32+ character `SETTLEMENT_WEBHOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`; register the [signed settlement contracts](./API.md#trusted-provider-webhooks).

For monthly email, set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, a verified `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET` and the service-role key. Register the public `/api/webhooks/email` URL with Resend.

Keep secrets in deployment environment/secret storage; never commit or expose the service-role key to the frontend. User-facing requests use the user's JWT.

Origins must be exact HTTP(S) origins without paths/wildcards. Behind ingress, replace `TRUST_PROXY=false` with its exact IPs/CIDRs or a named subnet list. Blindly trusting all forwarded headers is not supported; demo origin checks also reject forged forwarded hosts.

## Container deployment

The [Dockerfile](../Dockerfile) checks types in a build stage, installs production dependencies separately and runs as the unprivileged `node` user. Its [Dockerfile-specific ignore file](../Dockerfile.dockerignore) excludes secrets, databases, local dependencies and frontend output.

From the repository root:

```sh
docker build --file backend/Dockerfile --tag retrest-api:local .
# First configure backend/.env for the intended Supabase project.
docker compose --file backend/compose.yml up --build -d api
# After configuring email:
docker compose --file backend/compose.yml --profile email up -d
```

Compose explicitly disables the demo and exposes port 3001. The worker uses the same image with `npm run worker:email`; its health is measured through queue/worker monitoring.

On a cloud container platform:

- Publish this image and configure secrets externally.
- Run API replicas behind a TLS ingress, exposing container port 3001.
- Probe `/api/health` for liveness and `/api/ready` for readiness.
- Run independent email worker replicas against the shared database.
- Allow at least 15 seconds after SIGTERM to drain HTTP connections/current email batches.
- Set shared quotas at ingress or inject an atomic [RateLimitStore](../src/middleware/rate-limit.ts). Built-in limits are per replica.
- Configure the frontend's internal `API_URL`; browser requests keep using the frontend proxy.

No migrations run automatically at API startup. Readiness requires schema revision `20261123000000` or newer; an older schema returns 503 until the scheduling migration is applied. Liveness remains available during the upgrade.

[CI](../../.github/workflows/backend.yml) runs type checks, all backend tests, disposable HTTP smoke checks and a Linux image build. Live Auth/SMTP/Resend/provider behavior and hosted rollout need real credentials and an integration rehearsal; offline tests do not certify those services.

[Frontend CI](../../.github/workflows/frontend.yml) installs both locked app dependencies, runs frontend unit tests, installs Chromium and runs the isolated build/browser suite, including real Next/Express authentication routes. Both workflows use disposable data.

## Persistent demo

A hosted demo needs explicit `RETREST_DEMO_ENABLED=true`, a random 32+ character `RETREST_SESSION_SECRET`, `CARD_WEBHOOK_SECRET`, exact origins/proxy settings and a persistent database path.

Use one instance and a persistent volume at `/app/backend/data` for the container's default SQLite path. Do not share SQLite across replicas. Keep real account/provider data in PostgreSQL.

Seeding runs only when the demo account is absent; restarts preserve existing balances, settings, pools and history. Rehearse with `DATABASE_PATH=:memory:` instead of that volume.

## Backups and incident recovery

Enable Supabase managed backups/PITR and rehearse restores into a separate project. Keep provider event IDs with ledgers to preserve replay protection. Verify migrations/readiness, two-account isolation, reconciliation totals and a non-production webhook replay before routing traffic to a restore.

Back up SQLite through its backup command while running, or stop the demo before copying its database and WAL/SHM sidecars. Restore with the service stopped and preserve ownership. Never delete the database to troubleshoot a configuration issue.

`POST /api/demo/reset` resets the shared demo only; back up valuable state first. Account deployments disable demo reset, funding and authorization paths.

Crashes leave email leases recoverable by another worker. Jobs stop after five attempts or an expired provider idempotency window. Check provider event/idempotency history before a manual resend: a network error does not prove the provider rejected it.

Support incidents should retain thread/message/request IDs. `SUPPORT_ENABLED=false` disables new messages while retaining history; set `support_agents.disabled_at` to revoke staff inbox access.

Remove lost devices through the owner's API. Retain session revocation entries while the Auth session can still refresh; deleting them prematurely would restore access.
