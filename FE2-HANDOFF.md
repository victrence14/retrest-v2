# FE2 implementation handoff

The selected product is the restored [Next.js demo](./archive/next-app), launched from the repository root with `npm run dev` at `/shield`. This follows the [four-developer pitch brief](./PITCH-READINESS.md). The separate [Vite frontend](./frontend) and its completed theme/auth foundation remain intact.

**This is FE2 feature work for integration, not certification of a live payment product.** Invitations, funding, FX and settlement use the current demo contracts. New Pools, Insights and NotificationCenter exports still need FE1's shell mounts. Production authentication and the missing feature services remain blocked below.

## Completed modules & files changed

| Module | Implemented against verified contracts | Mount status |
| --- | --- | --- |
| Pools | Eligible unpooled subscriptions; deterministic equal shares; custom minor-unit validation; duplicate/host checks; guarded creation; reconciliation after uncertain/409 responses; confirmed member states, balances, fallback and simulated contributions | [PoolsPage](./archive/next-app/src/features/pools/PoolsPage.tsx), [PoolEditor](./archive/next-app/src/features/pools/PoolEditor.tsx) and [PoolDetail](./archive/next-app/src/features/pools/PoolDetail.tsx) exported for FE1; existing shell's embedded pools remain until extraction |
| Invitations | Existing server-rendered lookup; normalized invite-list email; login/device-preview return context; in-flight lock; server error/retry guidance; result displayed only after server response; safe repeat checks using the demo server's already-paid behavior | [InvitePage](./archive/next-app/src/features/invites/InvitePage.tsx) mounted through the compatible [invite card](./archive/next-app/src/components/invite-card.tsx) adapter |
| Transactions | Honest latest-100 snapshot filters/pagination; UTC dates; decision reasons; pool/wallet/FX detail; authenticated Blob PDF viewing/download; no receipt action for declined, pending, authorized or reversed records | [TransactionsPage](./archive/next-app/src/features/transactions/TransactionsPage.tsx) and [TransactionDetail](./archive/next-app/src/features/transactions/TransactionDetail.tsx) mounted through [transaction history](./archive/next-app/src/components/transaction-history.tsx) |
| Insights/Vault | Complete monthly business-expense results parsed from the real CSV schema; exact separate NGN/USD totals; currency filtering and paging over the full export; authenticated CSV/PDF/receipt downloads; recommendations limited to the server's `needs_review` flags | [InsightsPage](./archive/next-app/src/features/insights/InsightsPage.tsx) and [ExpenseVault](./archive/next-app/src/features/insights/ExpenseVault.tsx) await FE1's embedded Insights replacement |
| Monthly report | Complete server business export replaces the truncated-feed “AI” template; report downloads/copy; explicit unavailable email delivery, with no fabricated status or mail-draft “send” action | [SpendSummary](./archive/next-app/src/features/insights/SpendSummary.tsx) mounted through the compatible [summary adapter](./archive/next-app/src/components/spend-summary.tsx) |
| Settings | Confirmed Auto-FX preference, request lock, failure reconciliation and server persistence; existing account/device previews preserved; profile/account-action slots for FE1 | [SettingsPage](./archive/next-app/src/features/settings/SettingsPage.tsx) preference section mounted by [account settings](./archive/next-app/src/components/account-settings.tsx) |
| Support | Keyword bot, hardcoded FX reply, fake typing and delivery markers removed; static help articles with real navigation; messaging disabled because no transport exists | [SupportPage](./archive/next-app/src/features/support/SupportPage.tsx) / [SupportChat](./archive/next-app/src/features/support/SupportChat.tsx), mounted through the [support adapter](./archive/next-app/src/components/support-chat.tsx) |
| Notifications | Actual latest-30 feed/read markers; recent unread count; non-overlapping three-second polling while visible; error/retry refresh; review callbacks open subscriptions without financial mutation | Clean named/default [NotificationCenter](./archive/next-app/src/features/notifications/NotificationCenter.tsx) export awaits FE1's bell/dialog mount; generic read actions are blocked |
| Marketing/verification | Actual demo claims; relative product CTAs; production starter CTAs reject local/insecure configured origins and default to `/shield`; scoped landing CSS; metadata handoff; desktop/mobile browser journeys; disposable database runner | [Pitch landing](./archive/next-app/src/components/landing-page.tsx), [starter App](./landing-page/src/App.tsx), [starter styles](./landing-page/src/styles.css), [starter metadata](./landing-page/index.html), [destination helper](./landing-page/src/lib/product-destination.ts), [environment example](./landing-page/.env.example) |

Every feature has its own `api.ts` and scoped `styles.css` under [features](./archive/next-app/src/features). Shared [request/download helpers](./archive/next-app/src/features/shared/api.ts) use the selected application's HttpOnly cookie contract. [Money parsing](./archive/next-app/src/features/shared/money.ts), [share validation](./archive/next-app/src/features/pools/shares.ts), and [CSV schema parsing](./archive/next-app/src/features/insights/business-export.ts) are covered by meaningful boundary tests.

Verification files: [FE2 unit tests](./archive/next-app/tests/fe2.test.ts), [product browser tests](./tests/browser/product.spec.ts), [product configuration](./playwright.product.config.ts), [browser typecheck configuration](./tsconfig.product.json), [disposable runner](./scripts/test-fe2.mjs), [FE2 linter](./scripts/lint-fe2.mjs), and adjusted FE2 support/report expectations in the [existing UI tests](./archive/next-app/tests/ui/app.spec.ts). Root [scripts](./package.json) expose `lint:fe2`, `typecheck:product`, and `test:product`; [the lockfile](./package-lock.json) records the linter's existing PostCSS parser as a direct development dependency. The [starter browser configuration](./playwright.config.ts) excludes product tests so they cannot run against the wrong app.

## Pre-flight: verified API inventory

These are the selected application's existing handlers, not new backend implementations. Server model types are imported directly from [types.ts](./archive/next-app/src/lib/types.ts).

| Implemented handler | Exact contract used |
| --- | --- |
| [GET /api/state](./archive/next-app/src/app/api/state/route.ts) | `Dashboard`; complete owned pool/subscription lists, latest 100 transactions and latest 30 notifications |
| [POST /api/pools](./archive/next-app/src/app/api/pools/route.ts) | `{ subscription_id, name, members: [{name,email,share_amount}], fallback_enabled? }` → `{ state: Dashboard, invite_token }`; 2–10 members, positive safe-integer shares, unique emails, included host and exact target sum |
| [PATCH /api/pools/:id](./archive/next-app/src/app/api/pools/[id]/route.ts) | `{fallback_enabled:boolean}` or demo `{member_id:string}` → `Dashboard`; no allocation/name/member edit contract |
| [Server invite lookup](./archive/next-app/src/app/invite/[token]/page.tsx) | Existing server-rendered pool/host/merchant/target/date props; no GET invitation API |
| [POST /api/invites/:token](./archive/next-app/src/app/api/invites/[token]/route.ts) | Demo `{email}` → `{message}`; synchronous simulated contribution with an already-paid transaction guard; email-list lookup is not verified account identity |
| [GET /api/receipts/:id](./archive/next-app/src/app/api/receipts/[id]/route.ts) | Owned `APPROVED` record only; PDF with `?format=pdf`; selected app authenticates via its signed cookie |
| [GET /api/export](./archive/next-app/src/app/api/export/route.ts) | `month=YYYY-MM&format=csv/pdf`; complete approved business-expense query, no 100-row limit; CSV columns `Receipt ID, Date, Merchant, Amount, Currency, Status, Receipt URL` |
| [PATCH /api/settings](./archive/next-app/src/app/api/settings/route.ts) | Only `{auto_fx_enabled:boolean}` → `Dashboard` |
| [PATCH /api/subscriptions/:id](./archive/next-app/src/app/api/subscriptions/[id]/route.ts) | Existing merchant status/maximum updates also mark its notifications read. FE2's notification review button does **not** call this API |

Money is in integer kobo/cents, `NGN | USD`. [BE1's quote/authorization implementation](./archive/next-app/src/lib/authorization.ts) is simulated; the current quote comes from `Dashboard.exchange_rate`. New reports never convert historical totals with the current quote.

## Verification results

Verified on 21 November 2026 against the selected demo's implemented contracts:

| Exact command | Final result |
| --- | --- |
| `npm run typecheck` | **PASS** — restored application |
| `npm run lint:fe2` | **PASS** — owned TypeScript/unused-symbol diagnostics, nine scoped stylesheets, authenticated API boundaries and recommendation-ID checks |
| `npm test` | **PASS** — 28 tests: 17 existing financial tests and 11 FE2 boundary tests |
| `npm run typecheck:product` | **PASS** — browser tests/configuration; also invoked by the disposable runner |
| `npm run build` | **PASS** — normal Turbopack production build; the final sources also pass the disposable webpack production build inside `test:product` |
| `npm run test:product` | **PASS** — all 18 product checks (nine at 1440px desktop and nine at 390px mobile), followed by all four existing demo UI regressions |
| `npm run build:starter` | **PASS** — shared tokens/icons, all workspace typechecks, and frontend/backend/landing builds |
| `npm run test:starter` | **PASS** — all 10 existing token/backend/PostgreSQL setup tests |
| `npm run test:pwa` | **PASS** — all 36 desktop/mobile theme and Chromium PWA checks across the starter sites |
| `npm install --save-dev --package-lock-only --ignore-scripts --offline 'postcss@^8.5.33'` | **PASS** — records the installed parser without downloading or replacing runtime dependencies |

Earlier product runs failed on ambiguous alert selectors and early interaction with the existing login form before its controlled inputs hydrated. The FE2 tests now scope alerts to their feature and wait for the password-visibility control to react before entering login details. The final run preserves the login/device/invite return assertions and passes both widths. FE1 still owns preventing early interaction with its account forms in the product.

Screenshot review confirmed the restored navy/purple appearance, mobile Vault controls and centred receipt dialog. A read-only hash audit compared **67 protected files** with the pre-flight baseline and found **zero changes**, including FE1's shell/global/auth files, backend contracts, the existing theme foundation and the original demo database. Missing live services and production shell mounts remain pending; passing demo checks does not complete those acceptance conditions.

The [disposable runner](./scripts/test-fe2.mjs) copies sources/schema, links installed dependencies, creates private temporary secrets and a fresh database, builds a production app, and writes a **test-only** `/fe2-verification` mount in the copy. This route is never added to the real app. It verifies new exports while honoring FE1 ownership. It also runs the existing UI suite against that same disposable server and confirms the original demo database hash is unchanged.

`lint:fe2` runs TypeScript diagnostics/unused-symbol checks, PostCSS scoping checks and static authenticated-boundary/recommendation-ID checks. There was no existing repository-wide ESLint configuration; this command is specifically the FE2 linter.

Browser data is created through the real demo APIs. Delayed response tests forward requests to the real server and hold delivery to verify in-flight/confirmation behavior; they do not replace service data with mocks. The report test creates 110 actual signed demo authorizations and reconciles the complete business export while the dashboard remains capped at 100.

The [pitch walkthrough](./FE2-DEMO.md) describes current routes, integration prerequisites and generated screenshot/backup-video evidence.

## FE1 (Front-End One) Shell Requests

1. **Pools `/pools`:** replace the embedded pools body with `PoolsPage` from `@/features/pools/PoolsPage`, passing `initialData={data}` and `onStateChange={setData}`. Replace the `create-pool` dialog body with `PoolEditor` from `@/features/pools/PoolEditor`, passing `data`, optional `initialSubscriptionId`, `onCreated={({state}) => { setData(state); setModal(null); }}`, and `onCancel`. Resolve the duplicate page/header creation CTA during this extraction. The existing embedded form still uses its old validation/rounding until this mount is made.
2. **Insights `/insights`:** replace the embedded Insights/Vault body with `InsightsPage` from `@/features/insights/InsightsPage`, passing `data` and `onReviewSubscription`. Remove the embedded hardcoded `aws`/`youtube` usage suggestions and truncated Vault once replaced. The new component uses only server `needs_review` flags and complete business exports. The old shell body still contains those limitations until extraction.
3. **Notifications bell/dialog:** import the named `NotificationCenter` from `@/features/notifications/NotificationCenter`. Pass `initialData={data}`, optional `onStateChange={setData}`, `enabled={modal === "notifications"}`, and `onReviewSubscription={(id) => { setModal(null); setMerchant(data.subscriptions.find(s => s.id === id) ?? null); }}`. `onOpenTransaction(id)` is optional; otherwise the component links to `/transactions`. `onUnreadCountChange(count)` reports **recent-feed** unread rows, not an account-wide unread total. Review must open the existing merchant review UI; it must not authorize/replay a declined payment.
4. **Settings shared components:** keep the mounted [account settings](./archive/next-app/src/components/account-settings.tsx) adapter now. For the full Settings extraction, provide FE1's reusable profile and account-action exports through `SettingsPage`'s `profile` and `accountActions` ReactNode props. No reusable equivalent exists in the selected demo today; the separate Vite profile components require their own Supabase context. `user`, optional `busy`, and `onStateChange` wire confirmed state. Optional `requestAutoFx` must return a Promise after the shell mutation; the compatibility mount already does this.
5. **Summary presentation:** the existing summary dialog already mounts the new business report. Update the surrounding shell card/button copy from “AI summary”/email-ready spending to “Monthly business report”; full personal spending and server email delivery are not connected.
6. **Landing metadata:** export `pitchMetadata` from `@/features/marketing/metadata` as the landing route's metadata, or use it in the root metadata. [The layout](./archive/next-app/src/app/layout.tsx) is FE1-owned and was not edited. The actual landing CTAs already use relative `/shield` destinations. For a separate Vite landing deployment, configure `VITE_APP_URL` to the complete public HTTPS product URL or proxy `/shield` on the landing origin.
7. **Receipt entry points/help labels:** new Transactions details avoid the old green server receipt HTML. Remaining receipt anchors in the embedded shell should use FE2's authenticated detail/download boundaries during extraction; BE2 owns any remaining HTML receipt restyling. The shell's “Chat with us” control now opens help articles through its unchanged adapter; FE1 can rename the control to “Help”.
8. **Account-form readiness:** disable the existing login/device form controls until their controlled state is ready, or expose a stable readiness signal. Browser verification observed an email entered before hydration being cleared on the next render; FE2's return-flow test waits for an interactive password control without changing FE1's implementation.

No new production route or global stylesheet was edited. Existing invite, transaction, summary, settings and support mounts keep their prop interfaces. The complete enhanced pool/Vault/notification journeys are verified through temporary mounts until FE1 integrates them.

## BE1/BE2 (Back-End One / Back-End Two) Blockers

| Owner | Missing/incomplete endpoints or types | Consequence |
| --- | --- | --- |
| BE2 | Pool name/member/share edit schema and handler; current `PATCH /api/pools/:id` accepts only fallback or demo member contribution | Pool creation and fallback persist, but allocation editing cannot be implemented safely |
| BE2 + BE1 | Authenticated invitation lookup/acceptance; verified invitee identity; `expired`, `revoked`, already-paid/status schemas; live contribution initiation/status and durable idempotency contract | Current contribution flow is explicitly demo-only. Invite-list email checks and preview login do not satisfy verified-account/payment requirements |
| BE1 | Real authorization-versus-settlement lifecycle, provider contribution settlement, reversals/failures, live FX/historical quote semantics | `APPROVED` qualifies for a **demo** receipt under the current handler; it is not proof of real provider settlement |
| BE2 | Filtered server-paginated transaction/detail API beyond `GET /api/state`'s latest 100 | Current history remains an accurately labeled snapshot. The full-history acceptance condition is blocked |
| BE2 + BE1 | Complete personal/period-spend aggregates, recommendation evidence/schema, generated monthly summaries and server email delivery/status | Only complete monthly **business** spending is implemented using the verified export; personal totals, usage claims and delivery status are not fabricated |
| BE2 + FE1 | Persistent phone/preferences, confirmed Supabase email-change flow, device listing/revocation/trust schemas and authenticated selected-app identity | Auto-FX is server-backed; profile/device/auth previews remain labeled. Cross-browser Auto-FX does not prove live account/device security |
| BE2 | Selected support integration, thread/message storage and APIs, retry/idempotency and server availability | Messaging is disabled; no local chat or keyword bot impersonates a persisted/live service |
| BE2 | Generic notification list/read/unread endpoints, complete unread count and any realtime contract | Existing latest-30 state feed can be polled. Read markers are preserved exactly; FE2 does not misuse a financial rule update as a generic read action |
| BE2 | Production feature endpoints in the [Express backend](./backend/src/app.ts), which currently implements health/me/profile only | The Supabase/Bearer feature port is absent. Cookie-authenticated demo downloads do **not** satisfy the original Bearer-based production requirement |

BE2 must publish implemented endpoint paths, exact request/response types, ownership rules and errors before these live integrations continue. No speculative backend models, hardcoded production data or fake delivery/settlement states were introduced.

## GitHub main publication

The user explicitly requested publishing this delivery directly to `main`. Git works outside the sandbox; the earlier missing-developer-tools message came from the restricted execution environment and does not require a tools installation.

This delivery includes the earlier restored app and theme/auth updates alongside FE2's feature work, so collaborators can branch from the complete current project. FE2's feature changes still preserve the protected pre-flight baseline described above.

Run from the repository root, review the current changes and staged diff, then commit and push to `main`:

```sh
cd "/Users/egbetayo/Desktop/retrest-v2"
git status --short
git switch main
git add -A
git diff --cached --stat
git diff --cached
git commit -m "Restore pitch demo and add FE2 feature verification"
git fetch origin
git push origin main
```

If fetching reveals newer commits on `origin/main`, integrate them before pushing. Existing environment secrets, databases and test/build output remain excluded by [the ignore rules](./.gitignore).

After this delivery, the other developers can branch from the updated `main` using `feat/fe1-shell`, `feat/be1-settlement-fx`, and `feat/be2-feature-apis`, each with a reviewed PR to `main`. Merge contracts/mounts in the order agreed in the pitch brief; run the product suite after integration.

Copyable GitHub/agent prompt:

> Commit the reviewed current RETREST project directly on `main` and push it to `origin/main`. Include the restored navy/purple application, earlier theme/auth updates and verified FE2 feature work. Review the diff, preserve existing work, include the passing commands and counts from FE2-HANDOFF.md, and retain its FE1 mount requests and BE1/BE2 blockers. Exclude secrets, database files and generated test/build evidence. Fetch and preserve newer remote commits before pushing; use a normal push without creating an FE2 feature branch or pull request.
