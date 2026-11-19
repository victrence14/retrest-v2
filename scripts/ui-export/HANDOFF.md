# RETREST team UI handoff

This export contains 12 original RETREST screens as HTML, 24 full-page PNGs (1440px desktop / 390px mobile), React presentation source, theme tokens, and licensed local fonts.

## Import a screen into Figma

1. Install the [html.to.design Figma plugin and browser extension](https://html.to.design/).
2. In the unzipped export folder, run `node serve.mjs` with Node.js 18+.
3. Open **http://localhost:4400/screens/shield.html** in your browser. You should see the full dashboard with **Stay in control**, a sidebar, balances, and subscription rows.
4. Set your browser/capture viewport to **1440px** for desktop or **390px** for mobile. Capture the **whole page** using the html.to.design extension, then import that capture through its Figma plugin.
5. Inspect the imported layers. The dashboard should contain text layers such as **Stay in control** and **Connected subscriptions**, plus separate UI elements. Repeat the capture for the other screen URLs below. Stop the local server with Ctrl+C when finished.

**The page at http://localhost:4400/ is a review gallery.** Its cards contain PNG thumbnails. Capturing that page imports the gallery and its image previews, which is the wrong target for editing the actual screens. Open an individual HTML screen before starting the extension capture.

| Screen | URL to open and capture |
| --- | --- |
| Shield dashboard | http://localhost:4400/screens/shield.html |
| Marketing landing page | http://localhost:4400/screens/landing.html |
| Pools & Split | http://localhost:4400/screens/pools.html |
| Insights & Vault | http://localhost:4400/screens/insights.html |
| Transactions | http://localhost:4400/screens/transactions.html |
| Account settings | http://localhost:4400/screens/settings.html |
| Support | http://localhost:4400/screens/support.html |
| Login | http://localhost:4400/screens/login.html |
| Signup | http://localhost:4400/screens/signup.html |
| Forgot password | http://localhost:4400/screens/forgot-password.html |
| Reset password | http://localhost:4400/screens/reset-password.html |
| Device verification | http://localhost:4400/screens/device-binding.html |

These URLs use the default port. If you choose another port through `PORT`, substitute that port in the URLs. The full list is also included in [IMPORT-URLS.txt](./IMPORT-URLS.txt).

## Fonts and tokens

Install [Inter.ttf](./fonts/Inter.ttf) and [PlusJakartaSans.ttf](./fonts/PlusJakartaSans.ttf) if Figma reports missing fonts. Their OFL licenses are included beside them.

In Tokens Studio, import [original-ui.tokens.json](./tokens/original-ui.tokens.json) for the original dark UI's named CSS colors and base fonts. Bind imported layers to variables and build reusable Figma components as needed. The separate [starter-themes.tokens.json](./tokens/starter-themes.tokens.json) belongs to the newer Vite starters and does not describe the original screenshots.

HTML capture creates editable layers to the extent supported by html.to.design. Check gradients, blur, responsive layouts and font metrics after importing. PNGs provide flat pixel references. This bundle is an HTML import package; save a native `.fig` document from Figma after importing and organizing your screens.

## Review without Figma

Open [index.html](./index.html) in a browser and follow a screen's HTML link. Fonts and icons are bundled, so local review needs no internet connection, credentials, or database. The HTML files are static design snapshots. Main navigation links work; forms and application actions are inactive. No client JavaScript or API calls are included.

## Contents

- [screens/](./screens/): original screens with real HTML text, inline SVG icons and local fonts.
- [screenshots/](./screenshots/): desktop and mobile PNG references.
- [source/](./source/): original React presentation components, frontend helpers and authored CSS. These source components retain Next.js imports; the exported HTML runs independently. Backend/session code is excluded.
- [tokens/](./tokens/): original UI tokens and the separate starter themes.
- [fonts/](./fonts/): variable TTF fonts and redistribution licenses.
- [EXPORT-MANIFEST.json](./EXPORT-MANIFEST.json): capture dimensions and file checksums.

The export uses a fresh in-memory demo seed. Real environment files, databases, credentials, backend routes and repository metadata are excluded. It covers default screen states rather than every modal and interaction.

## Regenerate from the monorepo

Run `npm install`, `npm exec playwright install chromium`, then `npm run ui:export` at the repository root. The first export downloads fonts; later exports reuse them. Run `npm run ui:verify` to verify the ZIP. The output is `exports/retrest-ui-export.zip`.
