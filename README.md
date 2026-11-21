# RETREST

One master card. Every subscription protected. A working demo for recurring NGN and USD payments: per-merchant kill switches, price-hike limits, shared subscription pools, just-in-time FX, and business receipt exports.

The repository has two apps and one shared folder:

| Folder | What it is | Port |
| --- | --- | --- |
| [`frontend/`](./frontend) | Next.js 16 + React 19 UI. Renders pages and proxies `/api/*` to the backend. | 3000 |
| [`backend/`](./backend) | Express 5 API: authorization engine, SQLite demo database, receipts, webhooks, Supabase profile. | 3001 |
| [`shared/`](./shared) | Domain types and formatting used by both. Plain TypeScript, no dependencies. | – |

Each app installs its own dependencies. Nothing is installed at the repository root.

## Run it

Use **Node.js 22.18 or newer** (the backend uses Node's built-in SQLite).

```sh
npm run install:all                      # installs backend/ and frontend/ dependencies
cp backend/.env.example backend/.env     # then set the two secrets
cp frontend/.env.example frontend/.env.local
npm run dev                              # starts the backend and frontend together
```

Open http://localhost:3000 for the landing page, or http://localhost:3000/shield for the dashboard. On first start the backend creates and seeds `backend/data/retrest.sqlite`, which persists across restarts.

To run them separately, use `npm run dev:backend` and `npm run dev:frontend`, or `npm run dev` inside either folder.

## How the pieces connect

```text
Browser ──► Next.js (frontend, :3000)
              │  pages: Server Components call the backend with the visitor's cookies
              │  /api/*: rewritten (proxied) to the backend, same origin for the browser
              ▼
            Express API (backend, :3001) ──► SQLite (backend/data/retrest.sqlite)
                                          └─► Supabase (optional: /api/me, /api/profile)
```

- The browser only ever calls same-origin `/api/*`. The signed `HttpOnly` demo session cookie travels with every request, and the frontend never sees backend URLs or secrets.
- `frontend/.env.local` → `API_URL` sets where Next.js finds the backend.
- The backend rejects cookie-authenticated writes from untrusted origins (`CORS_ORIGINS` plus the proxied host).

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

Ada Okafor starts with ₦184,500 and $12.50 and six merchants: Netflix (₦7,000, shared pool), Spotify (₦1,300), ChatGPT ($20, business), AWS ($15, business), Canva (₦4,500, funded pool, business) and YouTube (₦1,900, paused). **Demo Simulator → Reset demo** restores everything. Sign-up, login and device verification screens are browser-only previews (device code **123456**).

## Tests

```sh
npm run typecheck   # backend + frontend
npm test            # backend (engine, API, Supabase profile, Postgres RLS) + frontend unit tests
```

With both servers running (these change demo data, so point `DATABASE_PATH` at a throwaway file first):

```sh
npm --prefix backend run test:http      # signed webhook, CSRF, scenarios, exports through the proxy
npm --prefix frontend exec playwright install chromium
npm --prefix frontend run test:ui       # desktop/mobile browser journeys
```

## Supabase (optional)

The backend's `/api/me` and `/api/profile` verify Supabase access tokens. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `backend/.env` to enable them. Until then they answer 503 and the rest of the app is unaffected. Migrations, seed data and RLS tests live in [backend/supabase](./backend/supabase). **Never** put `SUPABASE_SERVICE_ROLE_KEY` in the frontend.

## Beyond the demo

Issuance, funding, FX and contribution settlement are simulated, and no real card is issued or charged. For real users you need an issuer JIT integration with a hosted card-reveal flow, real authentication, an FX liquidity provider, bank settlement and reconciliation. Set `RETREST_DEMO_ENABLED=false` to disable every demo endpoint. SQLite suits a single instance; use PostgreSQL for multiple instances.
