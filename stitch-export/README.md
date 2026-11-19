# RETREST Google Stitch handoff

This package contains **24 self-contained HTML screens and 24 PNG references**: six views, in Light/Dark at desktop/mobile widths. Views cover sign-in, signup, profile, the offline signed-out workspace, marketing landing page, and a component-state sheet. They render the current React/Vite presentation components with shared tokens and fictional sample data.

No Stitch MCP server was connected when this export was prepared. No remote Stitch project or Figma document was created or updated. This is a portable source/reference package, not a native `.fig` file. The separate archived UI export is outside this package.

## Contents

| File | Purpose |
| --- | --- |
| [DESIGN.md](./DESIGN.md) | Resolved Light/Dark colors, typography, spacing, radii, shadows, layouts, reusable states and editing contract |
| [tokens.json](./tokens.json) | Exact Tokens Studio source shared by both applications |
| [screens/](./screens/) | HTML with inline CSS and embedded Inter; no JavaScript or remote assets |
| [screenshots/](./screenshots/) | Full-page PNG references at 1440px and 390px widths |
| [stitch-prompts.md](./stitch-prompts.md) | Screen-specific, theme/viewport-specific prompts with exact copy and token locks |
| [manifest.json](./manifest.json) | Stable variant IDs, viewport sizes, source fingerprints and SHA-256 checksums |
| [sync-map.example.json](./sync-map.example.json) | Optional mapping of local variants to your real Stitch and Figma links |
| [fonts/](./fonts/) | Inter font and SIL Open Font License |
| [styles/](./styles/) | Token-generated CSS and current shared/page/reference CSS |
| [serve.mjs](./serve.mjs) | Portable local preview with no npm dependencies |
| [upload.mjs](./upload.mjs) | Optional reference-document upload to your existing Stitch project; dry-run by default |
| [.env.example](./.env.example) | Private server-side Stitch configuration placeholders |

## 1. Review the actual screens

Install Node.js 22.18+; the extracted package requires no dependency installation. In this directory:

```sh
node serve.mjs
```

Open **http://localhost:4401/screens/login-light-desktop.html**. For mobile use **http://localhost:4401/screens/login-light-mobile.html** and set DevTools width to **390px**; the desktop reference width is **1440px**. Change `login` to `signup`, `profile`, `offline`, `landing` or `components`, and `light` to `dark` as needed. [IMPORT-URLS.txt](./IMPORT-URLS.txt) lists all URLs. `STITCH_PREVIEW_PORT=4402 node serve.mjs` selects another port.

If the default port 4401 is occupied, the launcher tries the next free port and prints the actual screen/gallery URLs. Use that printed port in every import URL. An already-running preview can be opened directly without launching another copy. Press **Ctrl+C** in its terminal to stop it. An explicitly set `STITCH_PREVIEW_PORT` stays fixed; if occupied, the launcher prints a short message instead of an error stack.

The [index.html](./index.html) gallery is for reviewing thumbnails and opening individual pages. Capture/import an individual **screens/*.html** URL: capturing the gallery imports thumbnails. Each HTML also opens directly from disk. Theme is locked by the file name; use the matching file rather than clicking its decorative theme controls. Forms are inert, so these references do not make account/API requests. Screenshots retain the intended viewport width even if your current browser window differs.

## 2. Connect your own Google Stitch account

Sign in at [Google Stitch](https://stitch.withgoogle.com/) with your own Google account. Create a project for the current RETREST starter or open your team's project. Use the current Stitch UI's sharing controls if teammates need access.

For MCP, follow [Google's MCP setup guide](https://stitch.withgoogle.com/docs/mcp/setup/). The official HTTP endpoint is `https://stitch.googleapis.com/mcp`; API-key authentication uses the `X-Goog-Api-Key` header. Obtain your own key using the account/settings workflow in that guide. Configure the key through your MCP client's secret input or environment support; do not put it in committed JSON. Available tool names/schemas and account options may change: inspect the connected tool catalog before invoking them.

For the optional local upload helper:

```sh
cp .env.example .env
# Edit .env with your own private key and existing project ID.
node upload.mjs --dry-run
# After reviewing all references, explicitly upload:
node upload.mjs --upload
```

`STITCH_API_KEY` is a private server-side credential, with **no VITE_ prefix**. `STITCH_PROJECT_ID` comes from your project's link. The helper reads this directory's `.env` only with `--upload`; existing process environment values take precedence. Real env files are ignored by the repository and excluded from regenerated ZIPs. Store credentials locally or in your team's secret manager, never in prompts, HTML, Figma files or source control.

An MCP client does **not** automatically load this package's `.env`. Configure its own secret/environment mechanism separately; the placeholder `STITCH_MCP_URL` documents the endpoint. Private Stitch configuration does not belong in frontend or landing-page env files.

The helper uses Google's `screens:batchCreate` endpoint and creates **reference DOCUMENT assets**, including DESIGN.md and the 24 HTML variants. It does not create projects, generate editable screens or overwrite previous versions. Re-running it creates more reference documents; inspect your project before retrying a partial/uncertain upload. It verifies package checksums first, uploads sequentially, and never logs keys or raw API responses. Dry-run makes no network requests. PNGs can be attached separately as visual references in the Stitch editor. REST upload availability depends on your account; if unavailable, use the manual workflow below.

## 3. Import or reproduce in Stitch without MCP

1. Open your Stitch project. Import/attach [DESIGN.md](./DESIGN.md) using the editor's available design-system/document workflow. If the interface cannot attach Markdown, paste its design spec into the project instructions or prompt.
2. For each named variant, attach the matching HTML reference and PNG from [screens/](./screens/) and [screenshots/](./screenshots/), using the import/upload controls available in your editor. If HTML upload is unavailable, use the PNG plus the spec and exact copy; retain HTML as the precise team reference. Uploading the ZIP itself is not a guaranteed Stitch import method: unzip it first.
3. Paste that variant's prompt from [stitch-prompts.md](./stitch-prompts.md). Generate/edit the design in Stitch and compare it against the HTML/PNG at the specified width. Preserve tokens, copy, font metrics and responsive behavior; generation may require corrections to match the reference.
4. Name all generated variants using the IDs in [manifest.json](./manifest.json). Use the component sheet to build shared components and states. Keep the six views × four variants; the offline view uses the same account layout with the genuine offline notice.
5. Record actual Stitch project/screen and later Figma frame URLs in a copy of [sync-map.example.json](./sync-map.example.json), kept outside the generated package (for example at the repository root as `stitch-sync-map.json`). The exporter intentionally preserves no account-specific mapping inside the portable bundle. Review generated views before handoff.

The generator/editor can produce editable designs from references. HTML upload alone does not establish exact editable Stitch screens or automatic sync. The reference package preserves the exact implemented UI so teammates can compare and correct any generated differences.

## 4. Use a connected Stitch MCP later

Once your client exposes Stitch tools, inspect their current schemas. List your projects, select/create the RETREST project, list existing screens and reconcile variant IDs before uploading. Add DESIGN.md and the HTML references. If available, use `create_design_system_from_design_md` with the uploaded spec's screen instance, then `apply_design_system` to the selected generated views. Google currently documents selected-screen objects using `id` and `sourceScreen`; follow your connected server's actual schema.

Use the supplied screen prompts through the server's supported generate/edit workflow. Review all generated screens, apply the same design system and map their real URLs. Avoid blind duplicate uploads. Credentials remain in your MCP client or local environment, never in exported files. This repository has no active background sync or scheduled remote writes.

## 5. Hand off editable screens to Figma

1. Install [Inter.ttf](./fonts/Inter.ttf), and use the Figma font helper if editing in the browser. Import [tokens.json](./tokens.json) with [Tokens Studio](https://docs.tokens.studio/); enable global plus Light or Dark, or the supplied theme. Apply/export variables and type styles using the features available in your plan.
2. In Stitch, select a reviewed generated screen and use **Copy/Export to Figma** if your account/editor offers it. Paste/import into your team Figma document. Repeat for each theme/viewport; names should match the manifest. Availability and exact button names can vary. Refer to [Google's Stitch documentation](https://stitch.withgoogle.com/docs/) for the current handoff UI.
3. If Stitch's Figma handoff is unavailable, open each individual HTML URL locally, use [html.to.design](https://html.to.design/) in Figma, and capture at the specified viewport. For localhost, use the plugin's browser-extension/local capture flow if its remote URL importer cannot reach your machine. Importing a PNG creates an image, not editable layout layers.
4. Organize pages by Frontend, Landing and Components; organize frames by theme and width. Convert repeated patterns to components with state variants and Auto Layout. Bind semantic fills, spacing and text styles to tokens, checking type metrics and responsive layout against the included PNGs. Imported native controls or special symbols may need cleanup.
5. Save/share the **Figma document link** with the team through Figma's own sharing controls. Record reviewed frame/component links in your sync mapping. This package is shareable reference material; it does not set Figma permissions or guarantee an automatic code/Stitch/Figma sync.

## Updating the package

In the original repository:

```sh
npm run stitch:export
npm run stitch:verify
npm run stitch:dry-run
```

This regenerates the tracked [stitch-export/](./) directory and the distributable ZIP under `exports/`. It reads only explicitly selected presentation/token/font files and fictional fixtures; no real Supabase sessions, environment values or database data are used. Commit token/component edits and the regenerated package together. Regeneration replaces generated docs, snapshots and examples but leaves your ignored `.env` untouched. Keep team-specific sync maps outside the generated directory. Upload accepted revisions and re-export affected Figma frames explicitly.
