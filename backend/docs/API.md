# Backend API contracts

Base URL: `http://localhost:3001` in development. The Next.js frontend proxies `/api/*`.

## Shared behavior

- JSON writes use `Content-Type: application/json`. Objects are strict: unknown fields are rejected.
- All `/api/v1/*` routes require `Authorization: Bearer <Supabase access token>`, confirmed email and an active server-side Auth session.
- Demo cookies do not authenticate versioned account routes. Bearer tokens do not authenticate the demo workspace.
- Responses use `Cache-Control: no-store` and `X-Request-ID`. Preserve the request ID in error reports.
- Errors have `{ "error": "safe human-readable message" }`. They never include SQL/provider credentials.
- Typical errors: 400 invalid input/cursor/state, 401 missing/expired/revoked identity or bad signature, 403 unconfirmed account/forbidden action, 404 inaccessible resource, 409 duplicate/conflicting state, 413 oversized JSON/PDF, 429 rate limit, 503 unavailable configuration/provider/database. Unexpected errors use 500.
- Unauthorized resource IDs are generally returned as 404. Bulk notification actions ignore IDs the caller does not own.
- Body limits: 16 KB for authentication/demo, 32 KB for versioned features/provider webhooks.

## Health

| Method/path | Response |
| --- | --- |
| `GET /api/health` | `{status:"ok",service:"retrest-api",test_instance:boolean}`; process liveness |
| `GET /api/ready` | `{status:"ready",service:"retrest-api"}`; probes configured PostgreSQL schema and/or the demo database |

`test_instance` is true only for an enabled in-memory demo running in test mode. Remote smoke tests require it before performing any mutation.

## Authentication

These routes are under `/api/auth`. They use Supabase Auth; they never create or reuse the shared demo identity.

| Method/path | Strict body | Success |
| --- | --- | --- |
| `POST /signup` | `{email,password,display_name}` | 202 `{confirmation_required:true}` |
| `POST /login` | `{email,password}` | 200 session response |
| `POST /refresh` | `{refresh_token}` | 200 session response; revoked session stays denied |
| `POST /verify` | Either `{token_hash,type}` or `{email,token,type}`; code `token` is a string of 6–10 digits; type `email`, `signup`, `recovery`, `email_change` | 200 session response, or 202 `{confirmation_required:true}` for a partial two-address email change |
| `POST /exchange` | `{auth_code,code_verifier}`; verifier 43–128 PKCE characters | 200 session response |
| `POST /resend-confirmation` | `{email}` | 202 `{ok:true}` |
| `POST /forgot-password` | `{email}` | 202 `{ok:true}`, including unknown accounts |
| `POST /logout` | No required body; Bearer token required | 200 `{ok:true}`; revokes the current server session and Supabase refresh session |
| `PATCH /password` | `{password}`; verified active Bearer session required | 200 `{ok:true}` |
| `PATCH /email` | `{email}`; verified active Bearer session required | 202 `{confirmation_required:true}`; current email remains authoritative until confirmed |

Signup/new passwords are 12–128 characters, display names 1–80 and emails at most 254. Login accepts existing passwords of 1–128 characters. Redirect destinations are server configuration, not client input.

Session response:

```json
{
  "session": {
    "access_token": "<token>",
    "refresh_token": "<token>",
    "expires_in": 3600,
    "token_type": "bearer"
  },
  "user": {
    "id": "<auth-user-uuid>",
    "email": "one@example.com",
    "email_verified": true
  }
}
```

`session.expires_at` is also returned if supplied by the provider. Store/refresh sessions in the consuming auth client or a secure frontend BFF. Do not add bearer tokens to receipt/download URLs.

The frontend's signup, login, forgot-password, reset-password and trusted-browser screens call these APIs. Its route handlers store account sessions and device trust in HttpOnly cookies and forward account JWTs to Express. Browser responses contain public identity and action results. The account workspace uses these sessions for `/api/v1/*`.

Confirmation/recovery callbacks support token-hash links, Supabase token fragments and PKCE exchanges with the initiating browser's verifier. The callback URL is cleaned after reading it. A partial secure email change confirms only one address and stays on the confirmation screen until the other address is confirmed.

The `/otp` page also accepts real emailed codes. Signup verification signs the account in; recovery verification opens password reset. Codes preserve leading zeroes, are validated by Supabase, and stay in component memory. Requests must use one of the two strict verification shapes above; mixing link and code fields is rejected. Resend controls have a 60-second cooldown.

To make code entry available, add `{{ .Token }}` to the **Confirm signup** and **Reset password** templates in Supabase Authentication. Keep the existing verification link alongside the code, for example:

```html
<p>Your verification code: <strong>{{ .Token }}</strong></p>
<p><a href="{{ .ConfirmationURL }}">Continue using the email link</a></p>
```

Supabase still controls email confirmation, password policy, secure email changes, code expiration and email delivery. Configure the backend's `AUTH_REDIRECT_URL` and `AUTH_RECOVERY_REDIRECT_URL` and allow-list both destinations in Supabase Auth.

## Collection pagination

Except categories, list endpoints accept `limit` (default 50, range 1–100) and an opaque `cursor`.

```json
{ "data": [], "next_cursor": null }
```

Rows are newest first by `created_at DESC, id DESC`. Request another page with the same filters and the returned cursor. Changing owner/resource/filters invalidates that cursor. `next_cursor:null` marks the last page; there is no dashboard-feed cutoff.

Canonical record types are in [features.ts](../src/contracts/features.ts); executable input schemas are in [feature-validation.ts](../src/lib/feature-validation.ts).

## Subscriptions and pools

All paths below are under `/api/v1`.

| Method/path | Input | Success |
| --- | --- | --- |
| `GET /subscriptions/categories` | No parameters | 200 `{data:[{slug,label}]}` |
| `GET /subscriptions` | Pagination; optional `active`, `business` as `true/false`, `currency=NGN/USD` | 200 page of owned subscriptions |
| `POST /subscriptions` | Subscription input below | 201 `{subscription}` |
| `PATCH /subscriptions/:id` | Any nonempty subset of subscription fields | 200 `{subscription}` |
| `GET /pools` | Pagination | 200 page of hosted or accepted-member pools |
| `POST /pools` | `{subscription_id,name,members,fallback_enabled?}` | 201 `{pool,members}` |
| `GET /pools/:id` | Owned/accepted-member pool ID | 200 `{pool,members}` |
| `PATCH /pools/:id` | Host only; `{name?,fallback_enabled?,status?}`, status `ACTIVE/CLOSED` | 200 `{pool}` |

Subscription input:

```json
{
  "name": "Music",
  "merchant_descriptor": "MUSIC",
  "amount_minor": 130000,
  "expected_max_amount": 150000,
  "currency": "NGN",
  "category_slug": "entertainment",
  "active": true,
  "billing_cycle": "MONTHLY",
  "next_billing_date": "2026-12-01",
  "is_business_expense": false
}
```

`category_slug` is optional/nullable and must reference a seeded category. `expected_max_amount` defaults to `amount_minor` and cannot be smaller. `active`, `billing_cycle` and `is_business_expense` default to true, MONTHLY and false on creation; omitted PATCH fields preserve their values. `merchant_descriptor` is normalized to uppercase and unique per owner. Pause/archive a subscription with `active:false`; financial history is retained.

Pool creation requires an active owned subscription, a 1–80 character name and 2–20 members:

```json
{
  "subscription_id": "<uuid>",
  "name": "Friends",
  "fallback_enabled": true,
  "members": [
    { "display_name": "Host", "email": "host@example.com", "share_amount": 65000 },
    { "display_name": "Friend", "email": "friend@example.com", "share_amount": 65000 }
  ]
}
```

Emails are normalized and unique; the confirmed host email must be included. Positive integer shares must exactly total the subscription amount. The host's membership is accepted immediately but starts unpaid. No funds are fabricated during creation. A subscription has at most one pool; close/reopen it instead of deleting its financial history.

## Invitations and contributions

| Method/path | Input | Success |
| --- | --- | --- |
| `POST /pools/:id/invites` | Host: `{member_id,expires_in_days?}`, default 7, range 1–30 | 201 `{invite,token,path}`; raw token returned once |
| `GET /invites/:token` | Verified invitee only | 200 `{invite,pool,member}` |
| `POST /invites/:token/accept` | Empty object/absent body; verified invitee only | 200 `{invite,pool,member}`; repeat returns same acceptance |
| `DELETE /invites/:id` | Host only | 200 `{ok:true}` |
| `POST /pools/:id/contributions` | Empty object/absent body; accepted member; `Idempotency-Key` required | 202 `{contribution,replayed}` |
| `GET /contributions/:id` | Host or accepted member of that pool | 200 `{contribution}` |

Invite tokens are 43-character base64url values; the database stores only their SHA-256 hashes. Creating another invite for an unaccepted member rotates the link. Expired/revoked links and non-invitees receive 404. A client-supplied email cannot select an invitee.

Revocation blocks future acceptance/contribution initiation and preserves existing settled funds and accepted membership history. Pool reading rights come from accepted membership; invitation revocation does not erase that membership.

`Idempotency-Key` accepts 8–128 letters, digits, underscores and hyphens. Retrying the same operation/key returns the original record. Reusing a key for a different operation payload is a conflict. A second concurrent contribution cannot double-fund a member.

Contribution response fields include `id,pool_id,member_id,user_id,amount_minor,currency,status,created_at,settled_at` (the initiation RPC also returns its idempotency key). `PENDING` means a stored request awaiting a payment adapter. Only a matching trusted settlement webhook can produce `SETTLED`, mark the member paid and credit the pool. Clients cannot submit a paid status.

## Transactions, insights, receipts and exports

| Method/path | Input | Success |
| --- | --- | --- |
| `GET /transactions` | Pagination and transaction filters below | 200 page; each row includes nullable `receipt_url` |
| `GET /transactions/:id` | Owned transaction ID | 200 `{transaction}` |
| `GET /insights/summary` | `month=YYYY-MM` or both `from/to` ISO timestamps; optional `business=true/false` | 200 period summary over all matching transactions |
| `GET /receipts/:id` | Optional `format=html/pdf`, default html | Owned SETTLED receipt; HTML or attached PDF |
| `GET /export` | Optional `month=YYYY-MM` (default current UTC month), `format=csv/pdf` (default csv) | All owned settled business expenses in the period |
| `GET /summaries` | Pagination | 200 page of owned immutable monthly snapshots |
| `POST /summaries` | `{month:"YYYY-MM"}` | 201 `{summary}`; repeat returns the existing snapshot |
| `GET /summaries/:id` | Owned summary ID | 200 `{summary}` |
| `POST /summaries/:id/email` | Empty/absent body, `Idempotency-Key` required | 202 `{job}`, or 503 when email is unconfigured |
| `GET /email-jobs/:id` | Owned job ID | 200 `{job}` with delivery status/attempt count |

Transaction filters: `month` or optional `from/to` (not both forms), `currency=NGN/USD`, `status=PENDING/SETTLED/DECLINED/REVERSED`, `business=true/false`, `subscription_id=<uuid>`. ISO timestamps accept offsets and normalize to UTC. `from` is inclusive and `to` exclusive. Period summary defaults to the current month and requires both boundaries when using timestamps.

Period summary:

```json
{
  "from": "2026-11-01T00:00:00.000Z",
  "to": "2026-12-01T00:00:00.000Z",
  "totals": [
    {
      "currency": "NGN",
      "settled_count": 12,
      "pending_count": 1,
      "declined_count": 2,
      "reversed_count": 0,
      "settled_amount_minor": "1560000",
      "fx_ngn_amount_minor": "0",
      "pool_amount_minor": "0"
    }
  ]
}
```

Totals are exact minor-unit **strings**; use BigInt/decimal arithmetic. No implicit NGN/USD conversion occurs. Transaction creation time determines report periods; receipt display dates use confirmed settlement time.

Pending/declined/reversed transactions have no receipt and cannot contribute settled spend. CSV headers are `Receipt ID,Date,Merchant,Amount,Currency,Status,Receipt URL`; amounts use exact two-decimal major units and status is `SETTLED`. Formula-leading cells are neutralized. CSV streams all pages; interrupted streams must be retried. PDFs support up to 5,000 receipts (413 above this); use CSV for larger reports.

Monthly snapshots are immutable at generation. Current totals/exports can change after a later settlement or reversal. With email delivery and the worker enabled, `monthly_summary_email=true` schedules the last completed UTC month's summary once per account/month. Opt-out cancels automatic jobs before another attempt. Explicit email requests are also available. `scheduled-summary-` is reserved for worker idempotency keys.

Email job states: `QUEUED,PROCESSING,ACCEPTED,DELIVERED,BOUNCED,FAILED`. The API resolves a confirmed recipient server-side. A 202 response means queued; provider acceptance is not proof of delivery.

## Profiles, settings, devices and notifications

| Method/path | Input | Success |
| --- | --- | --- |
| `GET /me` | — | 200 `{user:{id,email,email_verified:true}}` |
| `GET /profile` | — | 200 `{profile:{id,display_name,created_at,updated_at}}` |
| `PATCH /profile` | `{display_name}`, 1–80 characters | 200 `{profile}` |
| `GET /settings` | — | 200 `{settings}` |
| `PATCH /settings` | Nonempty subset of settings below | 200 `{settings}` |
| `GET /devices` | Pagination | 200 page; hashes and Auth session IDs omitted |
| `POST /devices` | `{name}`, 1–80 characters | 201 `{device,trust_token}`, token returned once |
| `DELETE /devices/:id` | Owned device | 200 `{device}`; session remains revoked after refresh |
| `GET /notifications` | Pagination, optional `unread=true` to show unread only; false/omitted shows all | 200 `{data,next_cursor,unread_count}` |
| `PATCH /notifications/read` | `{ids:[<uuid>...]}` (1–100) or `{all:true}` | 200 `{updated:number}`; repeats update zero already-read records |

Settings: `auto_fx_enabled:boolean`, `phone:E.164 string|null`, `theme:system/light/dark`, `time_zone:IANA string`, `email_notifications:boolean`, `monthly_summary_email:boolean`. New accounts receive defaults automatically.

Device trust is optional on ordinary requests: send `X-Retrest-Device-Token` to require it. Invalid/expired/wrong-session tokens return 401. Removing a device revokes its Auth session even when callers omit this header. Device registration trusts an existing login; it is not a second-factor challenge.

## Support

Paths are under `/api/v1/support`.

| Method/path | Input | Success |
| --- | --- | --- |
| `GET /availability` | — | 200 `{transport:"database_inbox",accepting_messages:boolean,response_mode:"asynchronous"}` |
| `GET /threads` | Pagination, optional `status=OPEN/CLOSED` | 200 page of the customer's own threads |
| `GET /inbox` | Staff only; pagination and optional status | 200 page of inbox threads |
| `POST /threads` | `{subject,body}`, `Idempotency-Key` required | 201 `{thread,message,replayed}` |
| `GET /threads/:id` | Customer owner or active staff | 200 `{thread}` |
| `PATCH /threads/:id` | `{status:"OPEN"|"CLOSED"}` | 200 `{thread}` |
| `GET /threads/:id/messages` | Pagination | 200 page; newest first |
| `POST /threads/:id/messages` | `{body}`, `Idempotency-Key` required | 201 `{message,replayed}` |

Subjects are 1–160 characters; message bodies 1–4,000. The server selects `CUSTOMER/AGENT`; clients cannot supply author or role fields. Staff replies create a persistent customer notification exactly once. Closed threads reject new messages with 409 but permit an identical retry of a previous message. Reopen through PATCH.

Disabled support rejects new POSTs with 503 and retains history. Availability describes a persistent asynchronous inbox; it does not claim an agent is currently online.

## Trusted provider webhooks

These endpoints use raw-body signatures and the service-role client, never a user JWT.

### Payment/contribution confirmations

`POST /api/webhooks/settlements` and `POST /api/webhooks/contributions` require `SETTLEMENT_WEBHOOK_SECRET` and server-only `SUPABASE_SERVICE_ROLE_KEY`.

Headers:

- `X-Retrest-Timestamp`: Unix seconds, within five minutes.
- `X-Retrest-Signature`: hex HMAC-SHA256 of `timestamp + "." + exact raw body bytes`.

Payment payload:

```json
{
  "provider_event_id": "provider-event-123",
  "provider_transaction_id": "provider-payment-123",
  "user_id": "<auth-user-uuid>",
  "subscription_id": null,
  "merchant_name": "Music",
  "amount_minor": 130000,
  "currency": "NGN",
  "status": "SETTLED",
  "is_business_expense": false,
  "fx_ngn_amount": 0,
  "pool_amount": 0,
  "decline_reason": null,
  "created_at": "2026-11-22T12:00:00Z"
}
```

`subscription_id` is optional/nullable; `created_at` is optional on initial creation (server time by default) and never changes later. FX/pool default to zero, decline reason to null. Status is PENDING/SETTLED/DECLINED/REVERSED; pool amount cannot exceed the charge. The trusted adapter must resolve user ownership from its verified provider/customer mapping.

Contribution payload:

```json
{
  "provider_event_id": "provider-contribution-123",
  "contribution_id": "<pending-contribution-uuid>",
  "status": "SETTLED",
  "amount_minor": 65000,
  "currency": "NGN"
}
```

Status is SETTLED or FAILED. Amount/currency must match the stored request. 200 responses contain the persisted transaction/contribution and `replayed`, plus `X-Idempotent-Replay`. Conflicting event IDs or immutable data return 400; impossible state transitions return 409.

### Resend delivery

`POST /api/webhooks/email` uses Resend's `svix-id`, `svix-timestamp`, `svix-signature` headers and `RESEND_WEBHOOK_SECRET`. RETREST validates the HMAC over `id.timestamp.rawBytes` and its timestamp.

`email.delivered`, `email.bounced`, `email.failed` update persisted job state using `data.email_id`. Other valid signed event types are acknowledged/ignored. Duplicate event IDs cannot change payloads. Events received before worker completion remain durable.

## Existing demo compatibility

The cookie demo retains `/api/session,state,bootstrap,subscriptions,pools,wallet,settings,demo,invites,receipts,export,webhooks/card-auth`. Its [original contracts](../../README.md#api) remain in place.

New complete demo queries:

- `GET /api/transactions`: same pagination/month/from/to/currency/business options; demo statuses are `APPROVED` and the existing `DECLINED_…` values.
- `GET /api/transactions/summary`: default current month, or month/both boundaries; returns `{from,to,totals:[{currency,approved_count,declined_count,approved_amount_minor,fx_ngn_amount_minor}]}`, with amount strings.

Demo CSV/receipts use APPROVED and remain labeled as simulations. Disabling the demo rejects signed demo cookies too. Legacy `/api/me` and `/api/profile` remain bearer-authenticated profile compatibility endpoints; prefer the versioned routes for confirmed-account and persistent session checks.
