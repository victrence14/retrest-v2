# RETREST

One master card. Every subscription protected. A working demo for recurring NGN and USD payments: per-merchant kill switches, price-hike limits, shared subscription pools, just-in-time FX, and business receipt exports.

The repository has two apps and one shared folder:

| Folder | What it is | Port |
| --- | --- | --- |
| [`frontend/`](./frontend) | Next.js 16 + React 19 UI. Manages account cookies and proxies API calls to the backend. | 3000 |
| [backend/](./backend) | Express 5 API: SQLite demo engine plus Supabase/PostgreSQL auth, account features, reports, support and email jobs. | 3001 |
| [`shared/`](./shared) | Domain types and formatting used by both. Plain TypeScript, no dependencies. | – |

Each app installs its own dependencies. Nothing is installed at the repository root.

The [backend guide](./backend/README.md) documents the implemented account APIs, scalable PostgreSQL architecture, tests, container setup and recovery. The frontend's existing demo remains compatible.

## Run it

Use **Node.js 22.18 or newer** (the backend uses Node's built-in SQLite).

```sh
npm run install:all                      # installs backend/ and frontend/ dependencies
cp backend/.env.example backend/.env     # then set the two secrets
cp frontend/.env.example frontend/.env.local
npm run dev                              # starts the backend and frontend together
```

Open http://localhost:3000 for the landing page, http://localhost:3000/login for your Supabase account, or http://localhost:3000/shield?demo=1 for the enabled demo. The demo creates and seeds `backend/data/retrest.sqlite`, which persists across restarts.

To run them separately, use `npm run dev:backend` and `npm run dev:frontend`, or `npm run dev` inside either folder.

## How the pieces connect

```text
Browser ──► Next.js (frontend, :3000)
              │  pages: Server Components call the backend with the visitor's cookies
              │  /api/auth/* and /api/v1/*: account Route Handlers manage HttpOnly cookies
              │  other /api/*: fallback proxy to the backend, same origin for the browser
              ▼
            Express API (backend, :3001) ──► SQLite (backend/data/retrest.sqlite)
                                          └─► Supabase/PostgreSQL (auth + versioned account APIs)
```

- The browser only calls same-origin `/api/*`. Account Route Handlers run before the fallback Express rewrite, store Auth tokens in `HttpOnly` cookies, and attach bearer tokens on backend account calls. Tokens are stripped from browser JSON responses. Demo calls use a separate signed `HttpOnly` session cookie.
- `frontend/.env.local` → `API_URL` sets where Next.js finds the backend.
- The backend rejects cookie-authenticated writes from untrusted origins (`CORS_ORIGINS` plus the API's own origin). Forwarded hosts cannot add trusted browser origins.

## Project structure

```text
frontend/src/
  app/                  Routes only: thin pages that render a feature
  components/ui/        Reusable primitives: Avatar, Toggle, DialogFrame, MerchantLogo, …
  components/layout/    Workspace shell: Sidebar, Topbar, PageHeading, BottomNav, PageFooter
  hooks/                useWorkspaceState (polling + mutations), useToast, useClipboard, useDialogFocus
  lib/api/              client.ts (browser fetch) and server.ts (Server Component fetch)
  lib/                  money parsing and navigation
  features/<feature>/   One folder per feature: components/, api.ts, plus feature logic
    workspace/          Composition root: context, selectors, dialog host
    shield/ pools/ insights/ transactions/ settings/ support/
    demo/ notifications/ help/ invites/ auth/ landing/

backend/src/
  server.ts, app.ts     Entry point and Express composition
  config.ts             Validated environment
  routes/               One router per resource (*.routes.ts)
  services/             Authorization engine, dashboard read model, documents, sessions
  middleware/           Demo session + CSRF origin checks, Supabase bearer auth
  db/                   Connection, transactions, seed (schema in backend/db/schema.sql)
  lib/                  HTTP helpers, validation, Supabase clients

shared/src/             Dashboard/API types and money/date formatting
```

To add a feature, create `frontend/src/features/<name>/` with an `api.ts` (typed calls through `@/lib/api/client`) and a `components/` folder. Add the matching router in `backend/src/routes/` and put its request/response types in `shared/src/types.ts`.

## API

All routes are under `/api`. The cookie routes need the demo session from `POST /api/session`.

| Method & path | Purpose |
| --- | --- |
| `GET /health` | Liveness |
| `POST /session` | Issue the demo session cookie |
| `GET /state` | Workspace snapshot (polled every 3 s) |
| `GET /bootstrap` | First server render: session workspace, or the public demo |
| `POST /subscriptions` · `PATCH /subscriptions/:id` | Connect a merchant · kill switch / price limit |
| `POST /pools` · `PATCH /pools/:id` | Create a split pool · host fallback / settle a contribution |
| `POST /wallet` · `PATCH /settings` | Fund the demo wallet · Auto-FX preference |
| `POST /demo` · `POST /demo/reset` | Run a simulator scenario · restore seed data |
| `GET /export?month=&format=csv\|pdf` | Monthly business receipt pack |
| `GET /receipts/:id[?format=pdf]` | One receipt (HTML or PDF) |
| `GET /invites/:token` · `POST /invites/:token` | Public invite · contribute (demo) |
| `POST /webhooks/card-auth` | Signed issuer authorization webhook |
| `GET /me` · `GET/PATCH /profile` | Supabase bearer-token profile (503 until Supabase is configured) |

### Issuer webhook contract

Amounts are **integer minor units**: `130000` means ₦1,300; `2000` means $20.

```json
{ "authorization_id": "issuer_event_123", "provider_card_id": "retrest_demo_master", "merchant_descriptor": "SPOTIFY", "amount": 130000, "currency": "NGN" }
```

- `x-retrest-timestamp`: Unix seconds, within five minutes of server time.
- `x-retrest-signature`: hex HMAC-SHA256 of `${timestamp}.${rawBody}` using `CARD_WEBHOOK_SECRET`.

Approvals return 200 with `decision: "APPROVE"`, the receipt URL and the funding breakdown. Rule or funding declines return 403 with a reason. Bad signatures return 401, invalid payloads 400, and an unavailable engine 503. Responses carry `Server-Timing` and `X-Idempotent-Replay`.

## Payment engine

One `BEGIN IMMEDIATE` transaction over indexed local reads ([backend/src/services/authorization.ts](./backend/src/services/authorization.ts)):

1. Replay an existing authorization ID without debiting again.
2. Resolve the card and merchant rule. Unknown merchants, frozen cards and currency mismatches are declined.
3. The merchant kill switch wins over price and funding checks.
4. Decline anything above the merchant's maximum and raise an approval notification.
5. Use pool funds first. For USD, convert only the missing host dollars from NGN (kobo rounded up).
6. Require host fallback when a pool shortfall remains.
7. Atomically convert FX, debit pool and wallet, write the receipt, and advance renewal by 30 days (365 yearly).

Declines have no wallet or billing-date side effects. The FX quote is simulated at **₦1,535.25 / USD** with 0% markup.

## Demo account

Ada Okafor starts with ₦184,500 and $12.50 and six merchants: Netflix (₦7,000, shared pool), Spotify (₦1,300), ChatGPT ($20, business), AWS ($15, business), Canva (₦4,500, funded pool, business) and YouTube (₦1,900, paused). **Demo Simulator → Reset demo** restores everything.

Signup, login, password recovery, email verification and trusted-browser registration use the Supabase account APIs. Email links and the optional `/otp` code-entry flow both work; Supabase validates every verification code. The [auth setup](./backend/docs/API.md#authentication) explains the email-template configuration.

## Appearance and action feedback

Light/Dark controls appear in landing and workspace headers, invitation pages and every auth screen. Appearance follows device settings by default; explicit choices persist across navigation, reloads and tabs. Signed-in account controls also save the preference through `PATCH /api/v1/settings`. Both settings screens offer **Follow device settings**.

Shared, dismissible notifications announce validation errors, failed requests and confirmed actions, including authentication, verification, device changes, settings, pool actions, reports and downloads. They survive client-side redirects and remain keyboard accessible inside dialogs.

## Tests

```sh
npm run typecheck   # backend + frontend
npm test            # backend (engine, API, Supabase profile, Postgres RLS) + frontend unit tests
npm --prefix frontend run build  # typecheck and verified webpack production build
```

The backend smoke runner creates its own in-memory server. The root browser runner builds a temporary frontend copy, starts production Next and a disposable Express API on free ports, then cleans up its own servers. It leaves existing development servers and hosted Supabase data alone. Auth transport is stubbed, while SQL migrations, account isolation and cookie/proxy handling run through the real implementation.

```sh
npm --prefix backend run test:http      # disposable signed webhook, CSRF, scenarios and exports
npm --prefix frontend exec playwright install chromium
npm run test:ui                         # isolated production build + desktop/mobile browser journeys
```

The suite covers mobile toast clearance, appearance persistence, auth validation/failures, redirect notifications and dialog dismissal. Additional integration journeys do not intercept browser API calls: they verify signup/confirmation, recovery, cookie security, token stripping, refresh/logout, device revocation, account isolation, pools, support and CSV downloads. Frontend CI runs the same isolated build and browser suite.

For a manually managed test server, use `TEST_ORIGIN=http://localhost:PORT` with `npm --prefix frontend run test:ui`. Point its `API_URL` at a disposable backend with `NODE_ENV=test`, `DATABASE_PATH=:memory:` and `RETREST_DEMO_ENABLED=true`. Clear its Supabase credentials; demo tests refuse to reset servers without `test_instance:true`. Real account integration tests run only through the root managed runner.

## Supabase (optional)

The frontend consumes [authentication and /api/v1 account features](./backend/docs/API.md): subscriptions, pools, verified invitations/contributions, complete transactions/aggregates, receipts/exports, settings/devices, notifications, support and summary email jobs. Apply all migrations and configure Supabase Auth as described in [setup and deployment](./backend/docs/DEPLOYMENT.md).

The backend's `/api/me` and `/api/profile` verify Supabase access tokens. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `backend/.env` to enable them. Until then they answer 503 and the rest of the app is unaffected. Migrations, seed data and RLS tests live in [backend/supabase](./backend/supabase). **Never** put `SUPABASE_SERVICE_ROLE_KEY` in the frontend.

The email worker automatically queues the last completed UTC month's summary for verified accounts that enable monthly emails, once per account/month. Delivery requires Resend credentials, a verified sender and the service-role key; see [email setup](./backend/README.md#email-and-settlement-adapters). Existing projects with the first four migrations need only [the new scheduling migration](./backend/supabase/migrations/20261123000000_scheduled_summaries.sql).

For Gmail confirmation links opened on a phone, use a public HTTPS app URL and configure matching Auth redirects, Supabase Site URL/allow-list, frontend `APP_ORIGIN` and CORS origins. `localhost` in an email points at the device opening it. Request a fresh email after changing these settings; see [the integration setup guide](./backend/docs/INTEGRATION-REVIEW.md).

## Beyond the demo

Versioned account features already use shared PostgreSQL with RLS and support multiple API replicas plus independent email workers. The SQLite authorization engine remains a single-instance simulation; the new ledger consumes confirmed events from trusted provider adapters.

The demo simulates issuance, funding, FX and contribution settlement. Production payment onboarding needs an issuer JIT integration with a hosted card-reveal flow, an FX liquidity provider, bank settlement and reconciliation. Set `RETREST_DEMO_ENABLED=false` to disable every demo endpoint. SQLite suits a single instance; account APIs use PostgreSQL for multiple instances.
