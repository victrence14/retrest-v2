# Retrest product API

All routes are served under `/api`. Interactive docs: `GET /api/docs`
(OpenAPI JSON at `GET /api/openapi.json`).

## Conventions

- **Auth** — every route except `/api/health`, `/api/openapi.json`, `/api/docs`
  and `GET /api/invites/:token` requires `Authorization: Bearer <supabase-access-token>`.
- **Money** — integer minor units (`500000` = ₦5,000.00). No floats.
- **Dates** — ISO 8601 UTC; rule payloads use `YYYY-MM-DD`, month filters use `YYYY-MM`.
- **Errors** — always `{ "error": "..." }`. Validation failures return `400`,
  ownership/IDOR attempts return `404`, conflicts return `409`.
- **Isolation** — all reads/writes run through the caller's Supabase client, so
  row-level security enforces ownership even if a handler is wrong. Server-side
  jobs and the issuer webhook use the service-role client only.

## Schema boundary with the payment layer

The product migration runs after the ledger migration and assumes these BE1
tables exist: `wallets`, `virtual_cards`, `transactions`, `notifications`, and
the base `split_pools` / `pool_members`. Product-owned schema added by
`20261120020000_product.sql`:

- subscription rule fields (`merchant_descriptor`, `max_amount_minor`,
  `billing_cycle`, `next_billing_date`, `is_business_expense`, `needs_review`,
  `plan_name`, `status`) plus the descriptor uniqueness index;
- `merchant_rules`, `user_devices`, `support_threads`, `support_messages`,
  `pool_contributions`, `spend_summaries`, `pool_schedules`, `product_events`;
- invitation expiry/revocation columns on `split_pools` and the invite RPCs.

Product tables reference the ledger by UUID only, so the payment provider choice
does not change any product endpoint.

## Subscriptions and merchant rules

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/subscriptions` | List rules ordered by next billing date |
| POST | `/api/subscriptions` | Create a rule (strict; `user_id` rejected) |
| GET | `/api/subscriptions/:id` | Read one rule |
| PATCH | `/api/subscriptions/:id` | Update status, max amount, next billing date, plan, business flag |
| DELETE | `/api/subscriptions/:id` | Delete a rule |
| GET | `/api/subscription-categories` | Reference categories |

Create body:

```json
{
  "merchant_name": "Spotify",
  "merchant_descriptor": "SPOTIFY",
  "expected_amount_minor": 500000,
  "max_amount_minor": 550000,
  "currency": "NGN",
  "billing_cycle": "MONTHLY",
  "next_billing_date": "2026-12-01",
  "is_business_expense": false,
  "plan_name": "Family"
}
```

Duplicate `(user, merchant_descriptor)` returns `409`. Descriptors are
uppercase `A-Z0-9 _.-` only.

## Shared pools, invitations and contributions

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/pools` | Hosted and joined pools |
| POST | `/api/pools` | Create a pool for a subscription |
| GET | `/api/pools/:id` | Pool + members (host or member only) |
| PATCH | `/api/pools/:id` | Host updates; `invite_revoked: true` kills the link |
| GET | `/api/pools/:id/contributions` | Contribution ledger |
| POST | `/api/pools/:id/contributions` | Record a contribution |
| GET | `/api/pools/:id/contributions/:contributionId` | Contribution status |
| GET | `/api/pools/:id/schedule` | Caller's recurring schedule |
| POST | `/api/pools/:id/schedule` | Consent to recurring contributions |
| PATCH | `/api/pools/:id/schedule` | Pause, resume or cancel |
| GET | `/api/invites/:token` | Public preview (no auth) |
| POST | `/api/invites/:token/accept` | Bind the verified identity to the invite |

Rules enforced server-side:

- **Shares equal the target** — the sum of `members[].share_amount` must equal
  `target_amount`, otherwise `400`.
- **One pool per subscription** — duplicate returns `409`.
- **Invite lifecycle** — links expire (`invite_expires_in_days`, default 14) and
  can be revoked by the host. `GET /api/invites/:token` returns
  `{ invite: { ..., valid, expired, revoked } }`.
- **Verified identity** — acceptance uses the signed-in account's verified email,
  never an email typed into the request. The invited member row is bound to
  `auth.uid()`; a different signed-in email gets `403`.
- **Contributions are idempotent** — `reference` is unique per pool. Replaying
  the same reference returns `200` with `replayed: true` and never applies the
  balance twice.

## Settings and devices

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/settings` | Wallet + auto-FX settings |
| PATCH | `/api/settings` | Toggle `auto_fx_enabled` |
| GET | `/api/devices` | List devices |
| POST | `/api/devices/challenges` | Start a challenge (6-digit code, 10 min TTL) |
| POST | `/api/devices/verify` | Verify within 5 attempts |
| DELETE | `/api/devices/:id` | Revoke a device |

The challenge code is returned in the response for the demo only; production
delivers it over the verified channel. Expired challenges return `410`, and a
used-up attempt budget returns `429`.

## Transactions, receipts and exports

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/transactions` | Paginated history (`limit`, `offset`, `month`, `status`, `currency`, `merchant`) |
| GET | `/api/transactions/:id` | One transaction |
| GET | `/api/receipts/:id` | Immutable settled receipt snapshot |
| GET | `/api/export?month=YYYY-MM&format=csv` | Month export with per-currency totals |

CSV output quotes untrusted values, escapes quotes/newlines and neutralises
spreadsheet formulas (`=`, `+`, `-`, `@`).

## Insights and spend summaries

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/insights?month=YYYY-MM` | Totals, top merchants, review flags with evidence |
| POST | `/api/spend-summaries` | Build/refresh a month summary |
| POST | `/api/spend-summaries/:id/email` | Deliver and track the summary email |

Insights cover the whole calendar month and preserve currency separation
(`totals` is an array, never a mixed sum). Review flags reference the
transaction or rule and include the evidence used (amounts, descriptor).

## Support and notifications

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/support/threads` | List threads |
| POST | `/api/support/threads` | Open a thread with a first message |
| GET | `/api/support/threads/:id/messages` | Thread messages |
| POST | `/api/support/threads/:id/messages` | Reply |
| GET | `/api/notifications` | Latest notifications |
| POST | `/api/notifications/:id/read` | Mark read |

## Mounting

BE1 mounts the whole product domain with one call after its auth middleware:

```ts
app.use('/api/invites', createPublicInvitesRouter(clients.auth)); // public preview
app.use('/api', requireAuth(clients));
app.use('/api', createProductRouter()); // subscriptions, pools, reports, support...
```

The only public product route is `GET /api/invites/:token`; everything else
requires a verified Supabase session.

## Jobs

- `backend/src/jobs/productEvents.ts` — `consumeTransactionEvents()` polls BE1's
  immutable `transactions` ledger and records one `product_events` row per
  transaction (`txn:<id>`). Retries return `duplicate` and never duplicate work.
- `backend/src/jobs/poolSchedules.ts` — `runDuePoolSchedules()` executes due
  consented contributions once per window using
  `schedule:<id>:<next_run_at>` references; `dispatchPoolReminders()` creates one
  reminder notification per window using `reminder:<id>:<next_run_at>`.
- `backend/src/jobs/summaryEmail.ts` — tracked delivery status
  (`NOT_SENT → SENT`); swap the stub for the configured provider.

Jobs run with the service-role client (`createAdminClient`), because
`product_events` is service-role only.

## Issuer webhook

`POST /api/webhooks/card-auth` is unauthenticated but HMAC-verified
(`x-retrest-timestamp`, `x-retrest-signature`), replay-protected by
`authorization_id`, and uses the service-role client. It returns `503` until
`SUDO_WEBHOOK_SECRET` is set.

## Demo flow

1. Sign in, `POST /api/card` to issue the virtual card and create the wallet.
2. `POST /api/wallet/fund` (demo funding) to top up NGN.
3. Create a merchant rule and a pool; invite a second account.
4. Accept the invite with the second account, contribute, then export the month.
5. Point the Sudo webhook at `/api/webhooks/card-auth` and trigger a sandbox
   authorization to see the decision, receipt and notification.
