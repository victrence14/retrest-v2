# RETREST: four-developer pitch handoff

Historical planning document. The current implemented backend contracts and operations are documented in [the backend guide](./backend/README.md). Status claims and archived application paths below predate the versioned PostgreSQL account APIs; use the current guide for integrations.

## Target and priorities

Prepare a reliable product demonstration using the restored [Next.js application](./archive/next-app), launched with `npm run dev` at `http://localhost:3000/shield`. Preserve its navy/purple design and existing journeys. This plan assigns work to four developers; it does not mean the tasks below have been implemented.

**P0** means required before the pitch. **P1** means required before presenting the corresponding capability as a live service or onboarding real users. A production payment pilot is a separate milestone.

The [Vite frontend](./frontend), [Vite landing page](./landing-page), and [Express backend](./backend) are separate workspaces. Their shared themes and Supabase auth foundation do not automatically apply to the restored application. Avoid moving the pitch onto the starter screens while financial features are still absent there.

## Current baseline

| Area | Present | Remaining work |
| --- | --- | --- |
| Pitch application | Shield, pools, invites, insights, transactions, settings, support, landing, and a persistent SQLite demo engine | Stabilize every demonstrated journey and verify a production build |
| Financial engine | Minor-unit arithmetic, merchant rules, price-limit declines, pool fallback, simulated FX, idempotent authorization, receipts | Verify edge cases; provider-backed issuance, funding, FX, and settlement remain future integrations |
| Authentication | Supabase signup/login/logout and a protected profile in the separate Vite starter | Configure a development project and verify live flows; the restored application's account/device screens remain previews |
| Themes | Shared Light/Dark tokens, system preference, manual override, and persistence in the two Vite sites | FE1 owns integration into the restored shell if this capability is included in the pitch |
| Reports | Server-generated monthly business-expense CSV/PDF exports | History and on-screen summaries currently consume a latest-100 dashboard feed; add complete server queries before claiming complete totals |
| Support and email | Labeled automated preview guide; monthly email action creates a mail draft | Persisted live support transport and actual email delivery/status are not connected |
| Devices/settings | Server-persisted Auto-FX setting | Profile/device previews need authenticated server persistence and email confirmation before being presented as live account management |

Sources: [original demo guide](./archive/next-app/README.md), [dashboard data access](./archive/next-app/src/lib/db.ts), [account settings](./archive/next-app/src/components/account-settings.tsx), [support guide](./archive/next-app/src/components/support-chat.tsx), and [backend/auth setup](./README.md#supabase-database-and-authentication).

## Ownership

| Developer | Owns | Main handoff |
| --- | --- | --- |
| **FE1 — Front-End One** | Shell, navigation, shared controls, Shield/dashboard, account/profile presentation, theme integration | Stable shell and documented feature mounts for FE2; auth integration with BE2 |
| **FE2 — Front-End Two** | Pools, invitations, transactions, Insights/Vault, summaries, settings, support, notifications, marketing, and browser verification | Feature journeys against verified contracts; pitch script and desktop/mobile evidence |
| **BE1 — Back-End One** | Authorization/settlement model, merchant rules, wallet/funding decisions, FX, financial simulator | Money/state contracts, deterministic financial scenarios, and engine test evidence |
| **BE2 — Back-End Two** | Database, auth, feature schemas/APIs, receipts/exports, settings/devices, support, notifications, deployment setup | Verified schemas, ownership rules, persistent feature data, and a reproducible pitch environment |

## FE1 task board

| ID | Priority | Task | Acceptance check |
| --- | --- | --- | --- |
| FE1-01 | P0 | Keep the restored app as the single pitch entry point; verify navigation, drawer/modal focus, keyboard dismissal, mobile layout, and shared profile/account controls | Every showcased route opens directly and through navigation at desktop/mobile widths; no overflow, dead controls, or browser errors |
| FE1-02 | P0 | Stabilize server/client rendering of dates and relative-time labels | Resolve the previously observed relative-time hydration mismatch; browser tests run clean across a minute boundary |
| FE1-03 | P0 | Create safe FE2 component boundaries for embedded pools, insights, and notifications without redesigning the interface | Document props, data ownership, refresh callbacks, routes, and mounts; FE2 can work without editing the shell |
| FE1-04 | P0 | Rehearse Shield, merchant pause/resume, limits, card/wallet actions, and simulator presentation with BE1 | Visible balances and outcomes match confirmed server state; repeated actions cannot leave stale or misleading UI |
| FE1-05 | P1 | Connect the restored account screens to BE2's verified authentication flow; integrate shared theme behavior if it is promised in the pitch | Live signup/confirmation/login/logout and protected navigation pass; theme follows the OS, supports manual choice, and survives reload while retaining the existing dark design |

Primary files: [shell and embedded feature container](./archive/next-app/src/components/retrest-app.tsx), [root layout](./archive/next-app/src/app/layout.tsx), [global styles](./archive/next-app/src/app/globals.css), [auth screens](./archive/next-app/src/components/auth-screen.tsx), [dashboard page](./archive/next-app/src/components/dashboard-page.tsx), [display formatting](./archive/next-app/src/lib/format.ts), and [shared theme package](./design-tokens).

## FE2 task board

| ID | Priority | Task | Acceptance check |
| --- | --- | --- | --- |
| FE2-01 | P0 | Complete pool creation/editing, equal/custom shares, member status, balances, and host fallback against the current verified demo contract | Shares total the target exactly in minor units, including deterministic remainders; duplicate/invalid members and shares are rejected; confirmed changes survive reload |
| FE2-02 | P0 / P1 | Rehearse the existing labeled demo invite journey; integrate authenticated acceptance/contribution states after BE1/BE2 supply real contracts | Demo contribution is clearly simulated; live invite acceptance is restricted to the verified invitee, retries are idempotent, and paid status requires confirmed settlement |
| FE2-03 | P0 | Finish transaction detail/history and Insights/Vault against BE2's complete server queries; align receipt presentation with the navy/purple brand | History reaches beyond 100 records; totals reconcile with server results and CSV/PDF exports; declined records have no receipt; downloads authenticate using the selected server contract |
| FE2-04 | P0 / P1 | Verify settings, summary, support, and notification UX; implement live persistence only after the required APIs/integration exist | Auto-FX and supported read actions survive reload; preview account/device/support/email behavior remains labeled; live email/device/support status comes from confirmed server state |
| FE2-05 | P0 | Verify the actual pitch landing page and CTAs; prepare a short demo script, screenshots, and a backup recording | CTAs reach the selected product build; deployed links never fall back to localhost; copy and pitch claims match connected behavior |
| FE2-06 | P0 | Own browser regression coverage for every demonstrated feature and report failures to its owner | Pool, invite, transaction/receipt, insights/export, settings, support, and notification journeys pass at desktop and mobile widths, including reload and error states |

Primary files: [invite card](./archive/next-app/src/components/invite-card.tsx), [transaction history](./archive/next-app/src/components/transaction-history.tsx), [spend summary](./archive/next-app/src/components/spend-summary.tsx), [account settings](./archive/next-app/src/components/account-settings.tsx), [support chat](./archive/next-app/src/components/support-chat.tsx), [pitch landing page](./archive/next-app/src/components/landing-page.tsx), and [demo browser tests](./archive/next-app/tests/ui/app.spec.ts). Coordinate any server-rendered receipt presentation changes with BE2.

## BE1 task board

| ID | Priority | Task | Acceptance check |
| --- | --- | --- | --- |
| BE1-01 | P0 | Verify authorization ordering, duplicate-event handling, merchant pause, price-limit declines, insufficient funds, and pool fallback | Retried authorization does not debit twice; declines do not change balances or billing dates; raising a limit permits a future retry and never replays a declined charge |
| BE1-02 | P0 | Verify NGN/USD minor-unit calculations, FX shortfalls, funding breakdowns, and quoted-rate display | A fully funded USD pool requires no FX; host shortfall is exact; rounding and balances agree between API decisions, receipts, and UI |
| BE1-03 | P0 | Supply repeatable simulator scenarios and expected results for FE1/FE2; coordinate disposable pitch fixtures with BE2 | A rehearsal can reproduce approval, kill-switch decline, price increase, FX, and pool fallback from known starting data |
| BE1-04 | P1 | Define real authorization-versus-settlement states and the contribution settlement contract before provider integration | Document authoritative state transitions, idempotency, failures/reversals, and receipt eligibility; no UI treats initiation or authorization alone as confirmed provider settlement |

Primary files: [authorization engine](./archive/next-app/src/lib/authorization.ts), [issuer webhook](./archive/next-app/src/app/api/webhooks/card-auth/route.ts), [demo API](./archive/next-app/src/app/api/demo/route.ts), [financial tests](./archive/next-app/tests/authorization.test.ts), and the financial portions of [seed/data access](./archive/next-app/src/lib/db.ts). BE2 maintains shared schemas/types; BE1 reviews all money and settlement changes.

## BE2 task board

| ID | Priority | Task | Acceptance check |
| --- | --- | --- | --- |
| BE2-01 | P0 | Publish a contract inventory for the selected Next.js demo APIs and the separate Supabase backend; define missing pagination/aggregate contracts before FE2 implements them | Every client integration points to an implemented endpoint and its exact schema, auth method, error responses, and state semantics |
| BE2-02 | P0 | Add complete transaction history/filtering and period aggregates to the selected pitch backend; verify owned receipt/export access | More than 100 records are reachable; period totals use all matching records; exports reconcile; cross-user and declined receipt access are denied |
| BE2-03 | P0 | Make the pitch environment reproducible: deployment/run instructions, private environment configuration, persistent demo database, disposable test data, and reset/recovery procedure | Another teammate can start the same build; demo state survives a restart; rehearsal/tests cannot overwrite the user's existing demo database |
| BE2-04 | P1 | Configure isolated Supabase development infrastructure, apply migrations/seed, and connect verified identity to the selected product backend with FE1/BE1 | Signup confirmation, login, logout, token expiry, protected APIs, and two-user isolation pass against the real development project; authenticated users do not inherit the shared demo identity |
| BE2-05 | P1 | Implement owner-scoped pool, invite/contribution, transaction, insight/summary, setting/device, and notification schemas/APIs | Publish exact types and migration/RLS evidence; changes persist on the server; contribution retries and invite state transitions follow BE1's settlement contract |
| BE2-06 | P1 | Select and wire actual support and monthly-email transports | Threads/messages persist, availability is server-backed, retries are safe, email confirmation/delivery status is authoritative, and device removal revokes server trust |

Primary files: [Next.js feature APIs](./archive/next-app/src/app/api), [SQLite schema](./archive/next-app/db/schema.sql), [shared types](./archive/next-app/src/lib/types.ts), [Express backend](./backend/src), [Supabase migrations/seed/RLS](./backend/supabase), [backend environment example](./backend/.env.example), and [collaborator instructions](./README.md#teammates-and-individual-access).

## Contract blockers and handoffs

The Express backend currently implements health, verified identity, and profile endpoints. Its Supabase migration contains profiles, subscriptions, and public categories. The following financial/feature contracts are not implemented there; corresponding Next.js demo handlers are not evidence of a completed Supabase port.

| Needed contract | Accountable owner | Client consumer |
| --- | --- | --- |
| Real settlement/funding status, authoritative FX quote, idempotency and receipt eligibility | BE1, with BE2 storage/API implementation | FE1 and FE2 |
| Authenticated pool CRUD, eligible subscriptions, members/shares/fallback | BE2; BE1 reviews financial invariants | FE2 |
| Verified invitee identity, acceptance, expiry/revocation, contribution initiation/status | BE2; BE1 defines settlement | FE2 |
| Filtered paginated transactions and authenticated receipts | BE2 | FE2 |
| Complete period aggregates, business filters, exports, recommendations, summary generation/email status | BE2; BE1 supplies verified FX semantics | FE2 |
| Persistent phone/preferences, confirmed email changes, device listing/revocation | BE2 | FE1 and FE2 |
| Support threads/messages, selected transport, server availability | BE2 | FE2 |
| Notification unread/read actions, review targets, polling/realtime contract | BE2 | FE2; FE1 mounts the center |

Backend owners must provide concrete implemented paths and schemas before dependent UI work proceeds. Label proposals and blockers explicitly. Do not invent response fields, substitute hardcoded recommendations, or present a keyword guide as live support.

FE1 owns shell edits and mounts. FE2 sends exact route/component/prop requests to FE1 and keeps new feature styles scoped locally. For the currently embedded sections, FE1 owns extraction and mount changes; FE2 then owns the feature components. BE2 maintains the shared type/schema boundary; BE1 approves financial state changes.

FE2 reuses FE1's shared profile and account-action components in Settings. FE2 supplies a clean `NotificationCenter` export with documented props; FE1 owns the shell mount and bell control. A notification review action opens the relevant subscription and must not replay a declined charge.

## Work order

1. **Agree on the pitch build and freeze contracts.** BE2 inventories the current API and defines missing data queries; BE1 confirms money/state semantics; FE1 establishes feature mounts. FE2 can audit existing feature presentation and prepare tests in parallel.
2. **Implement P0 work in parallel.** FE1 stabilizes shell/Shield, FE2 completes feature journeys and marketing, BE1 verifies the financial engine, and BE2 supplies complete data queries and a reproducible environment.
3. **Integrate and run checks.** FE2 runs desktop/mobile journeys; each developer fixes failures in their owned area. FE1 integrates shell mounts, BE2 integrates schema/API changes, and BE1 reviews monetary results.
4. **Rehearse and freeze the pitch revision.** Agree on one build, one demo dataset, expected outcomes, presentation URLs, and a backup recording. If a P1 capability is unfinished, present its current demo status accurately.

Use four separate branches or worktrees with small reviewed changes. Avoid simultaneous edits to the shell container, global stylesheet, shared types, or database initialization. Each handoff should include changed files, implemented contract, checks run, and remaining blockers.

## Pitch walkthrough

1. Open Shield and explain recurring-payment control using the demo account.
2. Run an everyday approval, then a paused-merchant decline; show that the declined payment leaves money unchanged.
3. Run a price increase; open the review action and explain that approval changes the limit for a future merchant retry.
4. Show pool creation/share allocation and a clearly labeled simulated contribution; demonstrate host fallback or the USD shortfall calculation.
5. Open the resulting transaction, explain the funding breakdown, and download a receipt/report.
6. Show settings and notifications briefly. Describe current auth/device/support/email previews accurately and identify the next integration milestone.

FE2 prepares the presentation script and backup recording. BE1 supplies expected amounts/outcomes. FE1 verifies presentation navigation. BE2 prepares a disposable dataset and recovery instructions. Real card issuance, bank funding, FX liquidity, live support, and email delivery must only be claimed after their integrations are verified.

## Final readiness gate

- Preserve the selected visual design and financial journeys; no switch to the separate starter screens.
- All presented actions have clear loading, success, and failure states and match confirmed server results.
- No unexplained browser errors or hydration warnings; desktop/mobile layouts and keyboard navigation pass.
- Money, receipt, and report figures reconcile against complete server data.
- Only eligible transactions expose receipts; review approval cannot replay a declined payment.
- Production CTA URLs and demo startup/recovery instructions are verified.
- Account, contribution, FX, device, support, and email claims distinguish connected services from previews/simulation.
- Record the exact passing commands and pitch revision. Running the existing tests is part of the developers' work below; this planning handoff does not certify that those P0 tasks are complete.

From the repository root, validate the restored application:

```sh
npm run typecheck
npm test
npm run build
```

In a disposable copy/environment, start the selected build and run its HTTP/browser tests from another terminal:

```sh
npm start
# Separate terminal, targeting this disposable server:
npm run test:http
npm run test:ui
```

The existing [HTTP smoke tests](./archive/next-app/tests/http-smoke.mjs) and [UI tests](./archive/next-app/tests/ui/app.spec.ts) mutate/reset the demo database. Keep them away from the user's existing data. If the starter/theme/backend workspaces change, also run `npm run build:starter`, `npm run test:starter`, and `npm run test:pwa`; these are separate from proof that the restored pitch application works.
