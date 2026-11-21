# FE2 pitch walkthrough and evidence

Start the restored product from the repository root with `npm run dev`, then open `http://localhost:3000/shield` in Chrome. The [feature handoff](./FE2-HANDOFF.md) distinguishes mounted improvements from exports still needing FE1 integration.

## Current mounted demonstration

1. On Shield, use the existing charge simulator to produce an approval and a price-increase decline. Explain that funding, FX and settlement are simulated.
2. Open `/transactions`, find those real demo records and select **View details**. Show the server's decline reason; the declined record offers no receipt. On the approved record, show pool/wallet/NGN-conversion facts, view the authenticated PDF and download it.
3. From Insights, open the existing monthly-summary dialog. Its content is now a **Monthly business report** using every matching server business expense. Show separate NGN/USD totals and the CSV/PDF downloads. Email delivery is explicitly unavailable.
4. Open `/settings`, change **Automatic NGN to USD conversion**, wait for server confirmation and reload. Explain that this preference persists; existing profile/device controls remain previews.
5. Open `/support` or the existing help drawer. Select a help article. Messaging is disabled because the support transport is not connected; there are no fake conversation/delivery indicators.
6. Follow a pool's invite link. The email must exist on its demo invite list. Login and the device preview retain the invite return context. Submit a **simulated** contribution; repeat/reload checks return the server's already-paid message without another contribution.

## After FE1 mounts the new exports

1. Use the new Pools creation form with a subscription whose target has a remainder when split. The listed equal shares assign extra kobo/cents in stable order and total the exact target. Demonstrate a duplicate email or incorrect custom total being rejected before submission.
2. Create the pool, reload, then change host fallback and simulate a member contribution. Only confirmed server state changes its member status or balance. Allocation editing awaits BE2's contract.
3. Use the new Insights/Vault body to filter a complete business month by currency and download its authenticated receipt pack. Server `needs_review` flags drive review links; no merchant ID claims that a plan is unused.
4. Open the new NotificationCenter. Its recent unread count and read markers come from the server; new entries arrive by three-second polling. **Review** opens the relevant subscription. It does not replay the declined charge.

## Reproducible verification and backup

```sh
npm run typecheck
npm run lint:fe2
npm test
npm run test:product
```

The last command creates a disposable production build/database and test-only feature mounts, runs desktop (1440px) and mobile (390px) journeys against real demo APIs, runs the existing UI regression suite, and stops its test servers. It does not reset the normal demo database.

Generated evidence lives in [test-results/fe2-pitch](./test-results/fe2-pitch): feature screenshots at both widths, a pool walkthrough recording when available, and a verification timestamp. Full browser videos/traces remain in [test-results/fe2-product](./test-results/fe2-product). These are local rehearsal evidence, excluded from Git. The temporary mounts in those recordings demonstrate FE2 exports awaiting shell integration; they do not certify a finished production shell.

The final run on 21 November 2026 passed all **18 product checks** at desktop/mobile widths and all **four existing app UI regressions**, with the original demo database unchanged. The starter regression checks also passed: **10 unit tests** and **36 theme/PWA browser checks**. Exact commands and remaining acceptance blockers are in [the handoff](./FE2-HANDOFF.md#verification-results).

For the deployed pitch, use the public HTTPS `/shield` URL agreed by FE1/BE2. The separate Vite landing page must set `VITE_APP_URL` to that complete public URL, or serve `/shield` through its own origin. Production CTA defaults never use localhost.
