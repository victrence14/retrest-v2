# RETREST

One master card. Every subscription protected. An interactive, persistent buildathon MVP for recurring NGN and USD payments.

## Run

Use **Node.js 22.18 or newer** (Node's built-in SQLite driver is required).

```sh
npm install
# Create .env.local from .env.example and set the two secrets.
npm run dev
```

Open http://localhost:3000 for the public landing page, or http://localhost:3000/shield for the command center. A local demo environment is already configured in this workspace. The database is created and seeded automatically on first use in `data/retrest.sqlite`; it survives restarts.

```sh
npm test         # 17 isolated authorization and document tests
npm run build    # TypeScript validation and production build
npm start        # Run the production build
```

With the server running:

```sh
npm run test:http             # Signed webhook, session, declines, FX, pools, receipt exports
npm exec playwright install chromium
npm run test:ui               # Desktop/mobile, switches, simulator, pool invites, CSV/PDF
```

HTTP/UI tests exercise the demo database. Use **Try a live demo → Reset demo to starting balances** afterwards. UI tests reset the demo first and last for repeatable runs.

## Interface and demo boundaries

The obsidian interface uses Inter and Plus Jakarta Sans, indigo card highlights, emerald shield states, amber treasury alerts, and coral declines. Shield, Pools, and Insights share a fixed glass navigation bar. Mobile merchant rows keep renewal dates, amounts, and Kill Switches visible together.

The landing page has interactive merchant previews and launches the live simulator. Header controls open the charge simulator and automated support guide in accessible drawers. Sign up, login, password recovery, and six-digit device verification are browser-only previews. Use the device demo code **123456**. The displayed AES-256-GCM badge describes the production security design; current backend demo sessions use signed HttpOnly cookies, and no credentials or OTP emails are submitted.

The monthly spend brief uses recorded demo payments and a deterministic template, with separate NGN/USD totals, category comparisons, and blocked savings. It uses the latest 100 available transactions, the current simulated FX rate, and current merchant limits. The email action opens a prepared draft in the user's email client; no email service or language model is connected.

## Stack and structure

- Next.js 16 App Router, React 19, TypeScript 5.9.
- Tailwind CSS 4 and custom responsive styles; Lucide and native SVG merchant icons.
- SQLite through `node:sqlite`, with foreign keys, integer minor-unit balances, indexes, WAL, and atomic transactions.
- Native Web Request/Response route handlers; HMAC issuer signatures and signed HttpOnly demo sessions.
- Persistent notifications, HTML/PDF receipts, CSV/PDF monthly business expense packs.
- Immediate mutation feedback and 3-second polling for externally generated payment events.

The relational definition lives in [db/schema.sql](./db/schema.sql). The authorization engine lives in [src/lib/authorization.ts](./src/lib/authorization.ts), and its issuer adapter lives in [src/app/api/webhooks/card-auth/route.ts](./src/app/api/webhooks/card-auth/route.ts).

## Payment architecture

Each user has exactly one card. A merchant subscription has a unique merchant descriptor, status, expected charge and maximum, plus one `merchant_rules` record. Changing the kill switch updates the subscription and rule in one transaction.

The authorization engine performs indexed local reads and one `BEGIN IMMEDIATE` transaction:

1. Replay an existing authorization ID without debiting again.
2. Resolve the master card and merchant rule. Unknown merchants, frozen cards, and unapproved currencies are declined.
3. Enforce the merchant kill switch before price and funding checks.
4. Decline any charge above the merchant's maximum and create an approval notification.
5. Compute the pool contribution and exact host shortfall. For USD, quote only the missing host dollars against NGN. A fully funded USD pool never triggers an unnecessary conversion.
6. Require pool fallback permission when a shortfall exists.
7. Atomically convert FX, debit the pool and host wallet, create the transaction/receipt, and advance renewal by 30 days (365 for an annual rule).

Funds are mutated only after every check succeeds. Declines have no wallet or billing-date side effects. Price-limit approval permits a future merchant retry; it never replays a previously declined charge as an approval.

The current executable FX quote is simulated at **₦1,535.25 / USD** with 0% demo markup. Kobo are rounded up when buying the exact missing USD cents. Safe-to-spend is a forecast, not a separate reservation ledger: the next seven days of active bills are subtracted, with available pool funds credited first.

## Issuer webhook contract

`POST /api/webhooks/card-auth`

Amounts are **integer minor units**: `130000` means ₦1,300; `2000` means $20.

```json
{
  "authorization_id": "issuer_event_123",
  "provider_card_id": "retrest_demo_master",
  "merchant_descriptor": "SPOTIFY",
  "amount": 130000,
  "currency": "NGN"
}
```

Required headers:

- `x-retrest-timestamp`: Unix timestamp in seconds, within five minutes of server time.
- `x-retrest-signature`: hexadecimal HMAC-SHA256 of `${timestamp}.${rawBody}`, using `CARD_WEBHOOK_SECRET`.

Approved charges return HTTP 200 with `decision: "APPROVE"`, receipt URL, transaction ID, and funding breakdown. Rule or funding declines return HTTP 403 with `decision: "DECLINE"` and a reason. Invalid signatures return 401, invalid payloads 400, and unconfigured/unavailable authorization returns 503. The adapter exposes `Server-Timing` and `X-Idempotent-Replay` headers.

The local warm authorization path measured approximately 0.7–2 ms during HTTP smoke testing. The 500 ms target is tested locally; production tail latency, provider network transit, contention, and cold starts require deployment measurements. Keep provider API calls out of this path and pre-cache an executable FX quote.

## Demo

Ada Okafor starts with ₦184,500 and $12.50. Six connected merchants:

| Merchant | Monthly charge | State |
| --- | --- | --- |
| Netflix Premium | ₦7,000 | Active; shared pool |
| Spotify | ₦1,300 | Active |
| ChatGPT Plus | $20 | Active; business expense |
| AWS | $15 | Active; business expense |
| Canva Pro | ₦4,500 | Active; funded pool; business expense |
| YouTube Premium | ₦1,900 | Paused; flagged for review |

The simulator runs the same authorization function as the signed webhook. Scenarios establish their merchant's active/paused state and expected limit for predictable demos; they do not refill wallets. The FX and pool scenarios use current balances and settings. Reset restores the original seeds, including renewal dates and activity history.

Pool creation supports equal/custom shares and generates a working invite link. Contributions are simulated: the host's share is deducted from their wallet; invited friends' payments represent a simulated external funding event. Automatic debit badges are scheduling indicators; a provider-backed scheduling worker is not connected.

## Moving beyond the buildathon

This is a working demo, with simulated issuance, funding, FX quotes, and contribution settlement. It does not issue or charge a real card. Before deployment for real users, integrate an issuer's JIT API/signature contract and secure hosted card-reveal flow, real authentication, an FX liquidity provider, bank-transfer settlement, and treasury reconciliation. Replace demo sessions and disable all demo endpoints with `RETREST_DEMO_ENABLED=false`.

PAN and CVV are intentionally absent from the database. Revealed card details are visibly marked demo data. SQLite suits a single persistent local/server instance; use PostgreSQL and row-level locking for multiple app instances, with idempotent receipts and notifications dispatched through an outbox after authorization.
# retrest-v2
# retrest-v2
# retrest-v2
# retrest-v2
