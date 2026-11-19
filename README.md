# RETREST monorepo

An npm-workspaces starter for the RETREST web app, API, and marketing site. The web app and landing page use React 19, TypeScript, and Vite. The API uses Node.js, Express 5, TypeScript, and Supabase (PostgreSQL + Auth). Both sites share Tokens Studio design tokens, theme controls, and base styles. The frontend includes a production service worker, an installable manifest, signup/login/logout, and a protected profile editor.

This is a fresh starter. The previous Next.js/SQLite demo, original configuration, tests, and documentation are preserved in [archive/next-app](./archive/next-app), outside the active workspaces. Its payment simulator and financial operations have **not** been ported into this starter. Its ignored local environment/data remain archived locally; do not commit them.

## Structure

```text
frontend/                  # Main React/Vite app; port 5173
  src/components/          # AuthForm, ProfilePanel, PwaStatus
  src/lib/                 # Browser Supabase client + authenticated API requests
  public/manifest.json     # Generated manifest, icons and favicon
backend/                   # Express API; port 3001
  src/middleware/          # Verified Supabase Bearer-token authentication
  src/routes/              # User-scoped profile endpoints
  supabase/                # CLI config, migrations, seed and RLS SQL tests
landing-page/              # Standalone React/Vite marketing site; port 5174
design-tokens/             # Shared npm workspace: @retrest/design-tokens
  tokens.json              # Tokens Studio source: global, light, dark
  generated/theme.css      # Generated CSS variables (committed)
  src/                     # Base styles, React theme provider, early theme bootstrap
scripts/                   # Dependency-free PWA icon generator
stitch-export/             # Current UI: design spec, 24 HTML/PNG variants, prompts
exports/                   # Ignored downloadable UI/Stitch ZIP packages
tests/                     # API/token tests and Chromium PWA/theme checks
archive/next-app/           # Preserved previous application; not an npm workspace
```

## Prerequisites

- Node.js **22.18+** and npm **10+**. Node 22 LTS is a good default; `.npmrc` rejects unsupported Node versions.
- A Supabase development project, or Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) for an isolated local stack.
- A current Chromium browser for install-prompt testing. Safari supports installation through Add to Home Screen, with a different browser UI.
- Optional: `psql` for the database RLS test. Docker is needed only when running Supabase locally.

## Quick start

Run once at the repository root:

```sh
npm install
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
cp landing-page/.env.example landing-page/.env.local
```

Configure Supabase and apply the SQL below **before running all services**. Fill in the copied environment files, then:

```sh
npm run dev
```

| Service | Development | Production preview |
| --- | --- | --- |
| Frontend | http://localhost:5173 | http://localhost:4173 |
| API | http://localhost:3001/api/health | `npm run start -w backend` |
| Landing page | http://localhost:5174 | http://localhost:4174 |

The root development command watches the token source as well as each service. You can also run each workspace independently in separate terminals:

```sh
npm run dev:frontend
npm run dev:backend
npm run dev:landing
# Optional when editing tokens alongside individual workspace commands:
npm run tokens:watch
```

Install dependencies from the root; npm links the shared token workspace automatically. Each workspace also has `dev`, `build`, and `typecheck` scripts. `backend` has `start`; both Vite workspaces have `preview`. Frontend and landing page render without Supabase credentials, with account actions disabled. The backend intentionally refuses to start with missing or placeholder credentials.

## Environment variables

| File | Variable | Purpose |
| --- | --- | --- |
| `frontend/.env.local` | `VITE_SUPABASE_URL` | Your Supabase API URL |
| `frontend/.env.local` | `VITE_SUPABASE_ANON_KEY` | Browser-safe anon JWT or publishable key |
| `frontend/.env.local` | `VITE_API_URL` | `/api` locally; production API base URL including `/api` |
| `frontend/.env.local` | `API_PROXY_TARGET` | Vite's server-side API proxy, default `http://127.0.0.1:3001` |
| `backend/.env` | `SUPABASE_URL` | Same project URL as the frontend |
| `backend/.env` | `SUPABASE_ANON_KEY` | Same browser-safe project key; requests also forward the user JWT |
| `backend/.env` | `SUPABASE_SERVICE_ROLE_KEY` | Optional privileged key for trusted admin jobs only |
| `backend/.env` | `PORT` | API port, default `3001` |
| `backend/.env` | `CORS_ORIGINS` | Comma-separated exact frontend origins, including preview if needed |
| `backend/.env` | `NODE_ENV` | `development`, `test`, or `production` |
| `landing-page/.env.local` | `VITE_APP_URL` | Frontend URL used by marketing calls to action |

Find keys in Supabase project **Settings → API / API Keys**. Supabase offers both legacy anon/service-role JWTs and newer publishable/secret keys. The browser field accepts an anon or publishable key. Supply the legacy service-role key for the optional administrative client. Do not use a secret/service-role key in the browser.

Vite exposes only `VITE_` variables, and embeds them at build time. Restart development servers after environment changes and rebuild production bundles when public configuration changes. The backend loads `backend/.env` in both source and compiled execution; deployment-provided environment variables take precedence. Root-level env files are not used.

All real env files are ignored; only `.env.example` files are tracked. Share credentials through your team's secret manager. **Never place `SUPABASE_SERVICE_ROLE_KEY` in a frontend file or give it a `VITE_` prefix**: it bypasses RLS. The ordinary API routes never use that key and work with it left blank.

## Supabase database and authentication

### Hosted development project

1. Create a Supabase development project. Set both apps' URL/key variables to that project.
2. Open its SQL Editor and run [the initial migration](./backend/supabase/migrations/20261119000000_initial.sql), followed by [the seed](./backend/supabase/seed.sql). The migration is applied once; the seed is safe to repeat.
3. Alternatively, with the CLI installed, run from `backend/`:

   ```sh
   supabase login
   supabase link --project-ref YOUR_DEV_PROJECT_REF
   supabase db push
   ```

   Then apply `supabase/seed.sql` through the SQL Editor. `db push` tracks migrations; do not also reapply the same migration manually.
4. In **Authentication → URL Configuration**, set the Site URL to `http://localhost:5173`. Add these redirect URLs for email confirmation:
   - `http://localhost:5173/`
   - `http://127.0.0.1:5173/`
   - `http://localhost:4173/`
   - `http://127.0.0.1:4173/`
5. Enable email/password signup, keep email confirmation enabled, and set a minimum password length of at least 8. Use Supabase's test email limits during development; configure SMTP for production. Add the real HTTPS frontend URL to the redirect allowlist before deployment.
6. Create an account in the frontend, open its confirmation link, sign in, save a display name, and sign out. Email confirmation uses PKCE; open the link in the browser that initiated signup. Profile creation happens automatically through the `auth.users` trigger.

### Isolated local Supabase

Each developer can use their own local database without shared hosted credentials:

```sh
cd backend
supabase start
supabase db reset
supabase status
```

`db reset` **deletes local data** and reapplies migrations/seeds; use it only for a disposable local stack. The committed CLI config already points to the seed file. Copy the local API URL and anon/publishable key from `supabase status` into the frontend and backend env files. The API URL is normally `http://127.0.0.1:54321`; Studio is normally `http://127.0.0.1:54323`. Confirmation emails go to the local email viewer whose URL `supabase status` reports.

Return to the root and run `npm run dev`. Stop the local stack with `supabase stop` from `backend/`. New schema changes belong in new timestamped files under `backend/supabase/migrations/`; keep development, staging, and production projects separate.

### Tables, RLS, and protected APIs

- `profiles`: one per Auth user. Users can read and update their own display name; the browser cannot insert profiles or change identity columns.
- `subscriptions`: starter schema for future features, with integer minor-unit amounts, NGN/USD currency, ownership index, and owner-only read/insert/update/delete policies. No subscription UI/API is implemented yet.
- `subscription_categories`: seeded public reference data; clients can read but cannot modify it.

All tables have RLS enabled and explicit privileges. The profile trigger uses a fixed empty `search_path`. No passwords or demo Auth users are seeded. Application identities come from Supabase Auth, not custom password tables.

| Endpoint | Access | Behavior |
| --- | --- | --- |
| `GET /api/health` | Public | Process liveness; does not test database connectivity |
| `GET /api/me` | Bearer JWT | Returns the verified user's ID and email |
| `GET /api/profile` | Bearer JWT | Returns only the caller's profile |
| `PATCH /api/profile` | Bearer JWT | Accepts only `{ "display_name": "Ada" }` |

Authentication middleware validates the token through `supabase.auth.getUser(accessToken)` rather than trusting a decoded JWT. It creates a fresh database client with the anon key **and the verified user's Bearer token**, so PostgreSQL RLS applies. Identity always comes from the verified user; supplied owner/ID fields are rejected. API responses send `Cache-Control: no-store`. CORS accepts only configured origins, and JSON bodies are limited to 16 KB.

### Teammates and individual access

**Dashboard collaboration:** A Supabase organization owner/admin can invite each teammate through **Organization Settings → Team / Members** using their own email, then assign the least privileged suitable role and project access. Available roles and project-scoped permissions depend on the Supabase plan. Each person signs in with their own Supabase account; never share dashboard logins or the database owner's password. A collaborator invitation is separate from an application user account.

**Development isolation:** Teammates may instead create separate dev projects or run the local stack, apply the same migrations, and set their own env files. Browser-safe project keys identify a project, not a teammate. Real end-user authorization comes from the Auth JWT and RLS. Privileged service keys are optional and belong only in approved backend environments.

**Direct PostgreSQL access:** For a teammate who needs SQL access, adapt [the individual-role template](./backend/supabase/teammate-role.sql.example) in a private SQL session. It creates a login without superuser or `BYPASSRLS`, grants only public-category read access, and supplies a policy for that named role. Use Supabase's Connect panel for the host, TLS/SSL requirements, and direct/session-pooler connection format; custom-role usernames may include the project reference when using a pooler. Give the person only their own password. Review any additional grants/policies explicitly. A direct SQL login does not automatically set `auth.uid()` and cannot use owner-only policies as though it were an application user. Schema migrations should use a dedicated controlled owner/deployer connection.

## PWA installation and offline testing

The frontend uses `vite-plugin-pwa`/Workbox with a generated service worker and a committed [manifest](./frontend/public/manifest.json). It has a stable app ID, name, start URL and scope, `display: standalone`, token-derived theme/background colors, real 192×192 and 512×512 PNG icons, a separate maskable icon, and an Apple touch icon. [The icon generator](./scripts/generate-icons.mjs) keeps these assets reproducible.

Service workers are **disabled in Vite development**. Test a production build:

```sh
npm run build
npm run preview:frontend
# In another terminal, if you want authentication/profile requests:
npm run dev:backend
```

1. Open **http://localhost:4173** in a current Chrome/Edge browser. Localhost is a secure-context exception; other hosts require HTTPS. Plain HTTP on a LAN IP is insufficient.
2. In DevTools **Application → Manifest**, check the name, standalone display, icons and absence of errors. Under **Service Workers**, confirm the worker is activated; reload once to ensure it controls the page.
3. Use the browser's install icon/menu or the **Install RETREST** button when `beforeinstallprompt` becomes available. The browser controls prompt eligibility, engagement rules, and prior-install/dismissal state; a valid manifest/worker does not force an automatic prompt. The button uses a real user click, and is hidden until the browser supplies an install event. On iOS use Safari's **Share → Add to Home Screen**.
4. Install and launch it; it should open in its own standalone window.
5. Enable DevTools **Network → Offline** and reload. The cached app shell renders and displays an offline notice. Auth and private API requests require a network connection and are never cached by the worker. A persisted login token is not a cached copy of profile data.
6. After a new deployment, the app offers an update prompt. Save changes before clicking **Update app**. Old precache versions are cleaned up after activation.

The automated PWA check validates Chromium's installability errors, the real PNG dimensions, a controlling service worker, offline reload, and the absence of private URLs from caches. It also checks both sites' theme behavior and mobile widths:

```sh
npm exec playwright install chromium
npm run build
npm test
npm run test:pwa
```

`npm run test:pwa` starts both preview servers and requires built output. The API tests use an injected Supabase verifier/database stub to check middleware denial, verified identity scoping, malicious payload rejection, and safe errors. `npm test` also executes the migration, repeatable seed, RLS SQL assertions and teammate-role template in embedded PostgreSQL (PGlite), with a minimal Supabase identity schema. It checks actual SQL permissions without project credentials. For validation against Supabase's full local environment, run this **against a disposable local Supabase instance after migration/seed**:

```sh
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f backend/supabase/tests/rls.sql
```

The SQL test creates two temporary users inside a transaction, checks owner isolation and denied anonymous/cross-user mutations, then rolls everything back. Hosted Auth and database end-to-end checks require your own configured dev project.

## Shared themes and Figma

[design-tokens/tokens.json](./design-tokens/tokens.json) is the source of truth. Its Tokens Studio format uses `value`/`type` tokens, aliases such as `{palette.forest}`, ordered token sets, and Light/Dark theme metadata. `global` holds palette, typography, spacing, radii, shadows and layout sizes; `light` and `dark` define the same semantic color names. Both applications bundle the licensed variable [Inter font](./design-tokens/assets/fonts/Inter.ttf) with a system-font fallback, making no external font request. The frontend precaches it for offline use. Install the same font in Figma to match browser text metrics; its [SIL Open Font License](./design-tokens/assets/fonts/OFL.txt) is included.

The generator resolves aliases, rejects missing/circular references and mismatched theme keys, and produces CSS variables such as `--color-background`, `--color-text`, `--font-family`, and `--space-5`. Both Vite apps import the **same generated CSS and base styles** through the shared workspace. App-specific layout styles use these variables.

```sh
# After editing tokens.json:
npm run tokens:build
# If changing the brand palette, also regenerate bitmap icons:
npm run icons:build
```

The normal root build runs both automatically. Commit changed token source and generated CSS/manifest/icons together. Use semantic tokens in component CSS rather than inline color literals. To add a semantic color, define it in **both** theme sets; to extend typography or spacing, add to `global`. The generator supports scalar tokens and aliases; add explicit conversion before introducing composite typography/shadow tokens or DTCG `$value`/`$type` syntax.

Both sites follow `prefers-color-scheme` initially. The shared provider tracks live OS changes in System mode. A toggle and System/Light/Dark selector let users override it, saving explicit preferences under `retrest.theme` in `localStorage`. The early bootstrap runs before rendering to restore saved preferences. Storage failures are handled, and tabs on the same origin receive storage changes. **Different origins/ports have independent storage**, so the app and marketing site share tokens and behavior but retain separate choices unless you later add a same-domain cookie or account-level preference.

For Figma:

1. Install [Tokens Studio for Figma](https://docs.tokens.studio/) and import `design-tokens/tokens.json` through its JSON editor or file import. You can also configure its Git sync against this file; keep Git credentials in the plugin, never in this repository.
2. Select the Light or Dark theme, or enable `global` plus one semantic theme set. Export/apply variables and text styles using the options available in your Tokens Studio/Figma plan. Confirm alias resolution and font availability.
3. Keep component names consistent between code and Figma: `AuthCard` (the `AuthForm` presentation), `ProfileCard` (the `ProfilePanel` presentation), `WorkspaceLayout`, `ThemeControl`, and `FeatureCard`. Build corresponding Figma components and variants, then bind their fills, typography and spacing to the imported variables.
4. For rendered layout capture, open the appropriate local or deployed URL and import it using [html.to.design](https://html.to.design/). Capture each theme/viewport separately and convert the resulting layers into reusable components. Captured pages do not automatically maintain a code-to-Figma link.
5. If your team configures a Figma MCP integration, provide the token file plus the target Figma document/frame links and component names through that workflow. This repository is ready for that mapping; no MCP account, sync credentials or live Figma connection is bundled.

## Share the original UI with the team

```sh
npm exec playwright install chromium
npm run ui:export
```

This creates `exports/retrest-ui-export.zip` and an unpacked `exports/retrest-ui-export/` folder. The bundle contains 12 original RETREST screens as static HTML, 24 desktop/mobile PNGs, Tokens Studio JSON, React presentation source, and licensed local fonts. For Figma import, run the bundle's `node serve.mjs` script, open **http://localhost:4400/screens/shield.html**, and capture that full dashboard with html.to.design. Repeat for other screen URLs listed in the handoff guide and `IMPORT-URLS.txt`. The exported `index.html` is a review gallery containing PNG thumbnails; importing it captures the gallery rather than the actual screen elements. The bundle's guide explains the import process and its limits; it is not a native `.fig` document. All rendered data comes from a fresh in-memory demo seed. Environment files, real databases and backend/session code are excluded. The first export downloads the fonts; subsequent exports reuse them.

## Google Stitch Export

The current React/Vite app and marketing UI are exported in [stitch-export/](./stitch-export), with [DESIGN.md](./stitch-export/DESIGN.md), [Tokens Studio JSON](./stitch-export/tokens.json), [screen prompts](./stitch-export/stitch-prompts.md), and **24 self-contained HTML + PNG variants**: sign-in, signup, profile, the offline workspace, landing page and a component-state sheet, each in Light/Dark at desktop/mobile widths. Snapshots render the same presentation components as the applications, use fictional sample data, and embed Inter and all CSS. They contain no JavaScript, API requests or external asset dependencies.

No Google Stitch MCP server is connected in this environment, so this export has not created or updated a remote Stitch project. The [portable handoff guide](./stitch-export/README.md) explains manual import, optional reference upload, connected-MCP design-system workflows, and Figma cleanup. The archived demo's separate export above remains available.

### Generate, verify and share

```sh
# After npm install; install Chromium once if needed:
npm exec playwright install chromium
npm run stitch:export
npm run stitch:verify
npm run stitch:preview
```

Share [exports/retrest-stitch-export.zip](./exports/retrest-stitch-export.zip) with the team. The extracted package requires Node.js 22.18+ for `node serve.mjs` and no dependency installation. Open **http://localhost:4401/screens/login-light-desktop.html** for the actual editable-element reference. Use the matching `*-mobile.html` at **390px**, or `*-desktop.html` at **1440px**, with the theme locked by the file name. The gallery at http://localhost:4401 contains thumbnail images; import an individual screen URL instead. [IMPORT-URLS.txt](./stitch-export/IMPORT-URLS.txt) lists every variant.

If port 4401 is occupied, the preview launcher tries the next free port; use the URLs it prints. You can open an already-running preview without starting another copy, or press Ctrl+C in its terminal to stop it. To select a fixed port, run `STITCH_PREVIEW_PORT=4402 npm run stitch:preview`; an occupied fixed port produces a short explanatory message.

The [manifest](./stitch-export/manifest.json) records stable variant IDs, source checksums and the shared token fingerprint. Regenerate after accepted token/component changes, then upload/re-export reviewed revisions. Local `.env` stays ignored and outside the ZIP. Keep actual team project/frame mappings outside the generated directory, starting with [sync-map.example.json](./stitch-export/sync-map.example.json); regeneration replaces generated references and examples.

### Connect a teammate's Stitch account

Each teammate signs in with their own Google account at [Stitch](https://stitch.withgoogle.com/) and opens/creates the appropriate project. Follow [Google's official MCP setup](https://stitch.withgoogle.com/docs/mcp/setup/) to configure an HTTP MCP client against `https://stitch.googleapis.com/mcp`, using the `X-Goog-Api-Key` header and the client's secret/environment mechanism. Obtain your own key through the account workflow in that guide and inspect the connected tool schemas before using them. Do not commit personal API keys or account credentials.

For the portable upload helper:

```sh
cp stitch-export/.env.example stitch-export/.env
# Fill in your own key and existing project ID locally.
npm run stitch:dry-run
# After reviewing the package, explicitly upload reference documents:
npm run stitch:upload
```

| Variable in [stitch-export/.env.example](./stitch-export/.env.example) | Meaning |
| --- | --- |
| `STITCH_API_KEY` | Private Stitch API key; blank placeholder, never prefixed with `VITE_` |
| `STITCH_PROJECT_ID` | Your existing project ID from its link; blank placeholder |
| `STITCH_MCP_URL` | Official MCP endpoint, documented for client configuration |
| `STITCH_API_BASE_URL` | Official REST API endpoint; the helper restricts requests to this host |

The helper loads this `.env` only for explicit uploads; dry-run reads no credentials and makes no network requests. Your MCP client needs its **own** environment/secret configuration and does not automatically read this file. The helper verifies checksums and uploads DESIGN.md and HTML as **reference DOCUMENT assets** using Google's `screens:batchCreate` API. It does not generate editable designs, create projects, overwrite existing screens or establish background sync. Inspect the project before repeating a partial upload; API availability can depend on the account. The exported PNGs and prompts are used in the editor to generate/edit reviewed screens.

### Import the design system/screens and hand off to Figma

1. In Stitch, attach [DESIGN.md](./stitch-export/DESIGN.md) through the available design-system/document workflow, or paste its spec into project instructions. Attach each named HTML/PNG reference and use its exact prompt from [stitch-prompts.md](./stitch-export/stitch-prompts.md). If HTML import is unavailable, use the PNG, spec and copy to reproduce the screen. Unzip the package first; ZIP upload is not a guaranteed import workflow.
2. Keep all variants named as in the manifest and compare generated screens with the HTML/PNG references. Use the component sheet to standardize states. With a connected MCP, use its current design-system create/apply and screen generate/edit tools where available, following their actual schemas; details are in the handoff guide.
3. Install the bundled Inter font and import the token JSON with [Tokens Studio](https://docs.tokens.studio/) in the team's Figma document. Enable global plus Light/Dark and map variables/text styles using the features available in your plan.
4. Use Stitch's **Copy/Export to Figma** action for reviewed generated screens when your account/editor offers it. Otherwise capture each individual local HTML URL with [html.to.design](https://html.to.design/), using its browser-extension/local capture flow if its remote importer cannot reach localhost. Preserve the specified viewport; PNG import produces image layers.
5. In Figma, organize Frontend/Landing/Components pages, theme/viewport frames, reusable components and state variants. Apply Auto Layout and bind imported fills, spacing and type to shared tokens. Check font metrics, native controls and special symbols; imported/generated designs can need cleanup. Share the Figma document through its own sharing controls and record reviewed frame links in your team mapping.

The portable snapshots preserve the implemented UI. Stitch generation and Figma transfer are explicit team workflows and may require corrections; the package does not promise automatic bidirectional code/Stitch/Figma synchronization.

## Production builds

```sh
npm run build                    # Tokens, icons, all type checks and all builds
npm run start -w backend         # Compiled Express server
npm run preview:frontend         # Local frontend preview
npm run preview:landing          # Local marketing preview
```

Deploy `frontend/dist` and `landing-page/dist` as separate static sites over HTTPS. Configure the frontend host to serve `index.html` for application navigations, while routing `/api` to Express rather than the SPA fallback. Alternatively set `VITE_API_URL=https://api.example.com/api` before building and put the frontend's exact origin in the backend CORS allowlist. The Vite proxy is only for development/preview. Deploy the backend with its compiled output, runtime dependencies, and server environment variables. Add production Auth redirects and the marketing `VITE_APP_URL`, then rebuild.

This starter does not implement payment processing, subscription CRUD UI, email delivery infrastructure, or offline writes. Extend those features with new migrations, owner-scoped endpoints, and appropriate tests. Keep the archived demo as reference until its behavior is deliberately migrated.
