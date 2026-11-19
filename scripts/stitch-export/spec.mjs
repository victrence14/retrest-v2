import { flatten, resolve } from '../../design-tokens/scripts/build.mjs';

export const screens = [
  { id: 'login', title: 'Sign in', source: 'frontend', component: 'WorkspaceLayout / AuthCard', intent: 'The signed-out workspace with email/password sign-in and a link to signup. Account access is configured; fields are empty.' },
  { id: 'signup', title: 'Create account', source: 'frontend', component: 'WorkspaceLayout / AuthCard', intent: 'The same signed-out workspace with name, email and password inputs, Create account, and a link back to sign-in.' },
  { id: 'profile', title: 'Personal profile', source: 'frontend', component: 'WorkspaceLayout / ProfileCard', intent: 'The signed-in workspace, with fictional alex@example.test, a Sign out action, and an editable display name of Alex Morgan.' },
  { id: 'offline', title: 'Offline workspace', source: 'frontend', component: 'WorkspaceLayout / PwaStatus / AuthCard', intent: 'The cached signed-out app shell. Include the actual offline notice above the sign-in form. Account changes need a connection; no cached profile, balance or offline transaction is shown.' },
  { id: 'landing', title: 'Marketing landing page', source: 'landing-page', component: 'Landing App / FeatureCard', intent: 'The complete standalone marketing page: navigation and theme controls, two-column hero, product preview, three feature cards, closing CTA and footer. Capture the entire scrollable page.' },
  { id: 'components', title: 'Component states', source: 'shared reference', component: 'ThemeControl / AuthCard / ProfileCard / PwaStatus', intent: 'A reference sheet, not a new product route. Show primary/quiet/hover/focus/disabled/loading controls, labeled inputs, error/success copy, notices, badges, theme controls, auth/profile cards and PWA update/dismissal actions.' },
];
export const viewports = [{ id: 'desktop', width: 1440, height: 1000 }, { id: 'mobile', width: 390, height: 844 }];
const table = (rows) => '| Token | Value |\n| --- | --- |\n' + rows.map(([token, value]) => `| \`${token}\` | ${value} |`).join('\n');

export function designSpec(tokens, fingerprint) {
  const global = flatten(tokens.global);
  const light = flatten(tokens.light);
  const dark = flatten(tokens.dark);
  const resolved = (name, set) => resolve(set[name], { ...global, ...set }, [name]);
  const colors = '| Semantic token | Light | Dark |\n| --- | --- | --- |\n' + Object.keys(light).map((name) => `| \`${name}\` | \`${resolved(name, light)}\` | \`${resolved(name, dark)}\` |`).join('\n');
  const selected = (prefix) => table(Object.keys(global).filter((name) => name.startsWith(prefix)).map((name) => [name, resolved(name, global)]));
  return `# RETREST design system

This spec describes the active React/Vite frontend and landing page. Use it with [tokens.json](./tokens.json) and the HTML under [screens/](./screens/). The archived Next.js demo has a separate export and is outside this design system.

Design token SHA-256: \`${fingerprint}\`. All exported variants use this exact token version. The manifest records source and file fingerprints. Regenerate the package after changing tokens or components.

## Product and visual direction

RETREST is a calm, personal starting point for recurring-payment habits. Use forest green, pale sage, generous space, bordered panels and restrained type. Preserve the current starter's copy and feature scope: account access, profile editing, theme settings and an installable/offline app shell. Marketing preview cards are illustrative. Do not invent payment processing, balances, charts, subscription dashboards or additional routes.

## Light and Dark semantic colors

${colors}

Background = page and input fill; surface = panel and quiet-button fill; surfaceRaised = notices and hero-visual fill. Text/muted = primary/secondary copy. Accent/onAccent = primary action and brand mark. Highlight/onHighlight = badges and hero-preview card. Border = 1px rules, panel outlines and input edges. Error/success = inline message text. Focus = keyboard outline.

Use semantic roles rather than choosing palette colors directly. Swap both sides of each color pair when changing theme. Do not use pure black, unrelated brand colors, gradients or decorative shadows.

### Primitive palette

${selected('palette.')}

## Typography

${selected('font.')}

Inter is the bundled variable font, licensed under the [SIL Open Font License](./fonts/OFL.txt). Install [Inter.ttf](./fonts/Inter.ttf) before editing in Figma. HTML snapshots embed this font as a data URI; there are no remote font requests.

Body: 16px/150%, weight 400. Section and feature headings: 20px/110%, weight 700. Base h1: 32px/110%, weight 700. Workspace hero: clamp(32px, 5vw, 64px); landing hero: clamp(32px, 7vw, 64px). At the supplied 1440px width both heroes are 64px; at 390px they are 32px. Landing lead paragraph: 20px/150%. Labels: 14px, weight 500. Buttons: 14px, weight 700. Eyebrows: 12px uppercase, weight 700, tracking .12em. Brand: 20px, weight 700, tracking .04em. Badges: 12px, weight 700. Footer/notices/hero notes: 14px. Default paragraph margins are zero.

## Spacing, radii, shadows and sizing

${selected('space.')}

${selected('radius.')}

${selected('shadow.')}

${selected('layout.')}

Use 1px borders for separation; the current shadow token is none. Focus outline is 3px with a 4px offset. Shell max-width is 1120px including gutters, centered; desktop horizontal padding 24px, below 640px 16px. Controls have a minimum 44px height. Buttons use 8px vertical and 16px horizontal padding, 8px radius. Inputs use 8px vertical and 12px horizontal padding, 8px radius. Panels use 32px padding and 24px radius; below 640px padding is 24px. Badges use 4px vertical and 12px horizontal padding with a pill radius. Stack gap is 24px; row gap is 12px; theme-control gap is 8px. Product-preview card radius is 16px and its minimum height is 220px, as in the source layout.

## Responsive layouts

- Desktop reference: 1440 × 1000 viewport; screenshots include the full page height. Mobile reference: 390 × 844 viewport; screenshots likewise include the full page. HTML remains fluid: set the capture viewport to the reference width.
- Header: horizontal brand and controls, 24px vertical padding and a bottom border. Below 640px allow wrapping, preserving readable labels and 44px controls.
- Workspace: columns 1fr / minmax(0, 440px), align-start, 64px gap and vertical padding, minimum 75vh. Intro top padding 32px. At or below 800px use one column, 32px gaps/padding, no intro top padding. Intro paragraphs max-width 440px.
- Landing hero: columns 1.1fr / 1fr, vertically centered, 64px gap, 96px vertical padding. At or below 800px use one column, 32px gap and 48px vertical padding. Preserve the product preview below the hero copy.
- Feature grid: three equal columns, 16px gap; at or below 800px one column. Possibilities section has 48px vertical padding; closing panel has 48px vertical margins. Footer is bordered with 32px vertical padding.
- Reference sheet: two columns collapse at 800px. This sheet uses export-only layout CSS and forced hover/focus examples; it is not an extra application screen.

## Reusable components and states

| Component | States and contract |
| --- | --- |
| WorkspaceLayout | Shared brand/header, theme control, intro, account/PWA status, content and footer. Signed out: no email/logout. Signed in: email and Sign out. Logging out: Signing out… with disabled action. Session restoration: Opening your workspace… |
| AuthCard (AuthForm controller) | Login: email/password, Sign in, signup switch. Signup: name/email/password, Create account, login switch. Password minimum 8 characters; name maximum 80. Submitting: Please wait… and disabled primary/switch. Unconfigured: setup notice and disabled primary. Error: inline error token text. Signup success: confirmation-email notice using success token. |
| ProfileCard (ProfilePanel controller) | Display name, Save profile. Loading: Loading your profile… replaces the form. Saving: Saving… and disabled action. Success: Your profile is saved. Error: inline error token text. Display name maximum 80 characters. |
| ThemeControl | Manual toggle shows the target theme (Dark mode in Light; Light mode in Dark). Native labeled select: System/Light/Dark. Live app follows prefers-color-scheme by default, responds to OS changes in System mode, persists explicit choices in localStorage key retrest.theme. Each origin has its own preference. Exported references lock a single mode and controls are visual only. |
| Button | Primary accent/onAccent, or quiet surface/text/border. Hover: brightness(1.08). Focus-visible: 3px focus outline, 4px offset. Disabled: opacity .65, cursor wait. Do not introduce an extra error-input border; current errors are message text. |
| Input / select | Background/text fill, border, 8px radius, label above with 8px gap. Focus follows shared focus outline. Keep native email/password/name semantics and readable labels. |
| Panel / FeatureCard | Surface fill, 1px border, 24px radius, no shadow. FeatureCard: eyebrow, heading and paragraph in a 24px stack. |
| Badge / eyebrow | Highlight/onHighlight pill, or accent uppercase label. Preserve typography and spacing above. |
| PwaStatus | Offline notice: You’re offline. The app is available; account changes need a connection. Installation button appears only when the browser offers an install event. Ready to open offline. + Dismiss. Update notice + Update app + Later. Service-worker failure notice. No private API data caching or offline writes. |

The component sheet uses fictional sample states; error copy can vary with the actual backend/Auth response. Installation controls in a static reference do not imply a live browser install prompt. Forms are inert and HTML contains no JavaScript.

## Accessibility and Figma mapping

Preserve semantic headings, form labels, status/alert roles, visible keyboard focus, and 44px minimum control sizes. Keep text and foreground/background pairs unchanged; check any new combinations for WCAG contrast. Respect reduced motion. HTML preserves selectable text, forms, panels and links; screenshots are review references.

In Figma, create a RETREST collection with Light/Dark modes, import [tokens.json](./tokens.json) through Tokens Studio, and map matching semantic variables. Use slash-named components: Button/Primary, Button/Quiet, Input/Text, AuthCard/Login, AuthCard/Signup, ProfileCard, ThemeControl, FeatureCard, Notice/Offline, Notice/Update. Add state variants from the table. Use Auto Layout for stacks/rows and bind fills, type and spacing to tokens. Confirm the bundled font is installed before import. Stitch or html.to.design transfers may need cleanup and variable rebinding; exporting HTML is not a native Figma document or automatic bidirectional sync.

## Source and editing contract

[stitch-prompts.md](./stitch-prompts.md) identifies every theme/viewport variant and gives exact visible copy. Attach this spec, the requested HTML and its PNG reference before generating or editing in Stitch. Change only the requested part; preserve all other copy, component states, dimensions and semantic tokens. Update the code/token source and regenerate references when accepting a design change, then re-export affected Figma frames. Track actual project/screen/frame links separately using [sync-map.example.json](./sync-map.example.json); do not put credentials in the mapping.
`;
}

export function prompts(manifest) {
  const header = `# RETREST — Stitch screen prompts

Token lock: \`${manifest.tokens_sha256}\`. Use [DESIGN.md](./DESIGN.md) and [tokens.json](./tokens.json) as the design authority. The manifest maps each HTML/PNG pair to its source and viewport. All six reference views below are from the current Vite starter, including one component-state sheet.

## Shared instruction for every generation or edit

Attach DESIGN.md, the individual HTML screen and its PNG. Reproduce the supplied layout and content at the requested width using the exact semantic colors, Inter typography, spacing, radii and component states. Build editable elements and reusable components in the Stitch editor. Uploaded HTML documents and images are references; they are not automatically editable generated screens. Do not import the gallery as a screen. Do not add fictitious payment, balance, transaction or subscription functionality. Keep desktop/mobile and Light/Dark variants as separately named screens. If a reference cannot be attached in your editor, paste the relevant spec and exact copy and use the PNG as the visual reference.

For edits, prepend: “Edit only [requested component/change]. Preserve all other layout, copy, state, Inter metrics, and token values from DESIGN.md. Return the named ${'variant'} and explain any requested change that conflicts with the design system.” Resolve token changes in the source and regenerate this package before handing off accepted changes.

## Screen-specific prompts
`;
  return header + manifest.screens.map((screen) => `
### ${screen.title}

- Stable variant ID: \`${screen.id}\`
- HTML reference: [${screen.html}](./${screen.html})
- Image reference: [${screen.screenshot}](./${screen.screenshot})
- Source: ${screen.source}; components: ${screen.component}.
- Token SHA-256: \`${screen.tokens_sha256}\`

\`\`\`text
Create or edit “${screen.title}” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: ${screen.theme}. Target viewport: ${screen.width} × ${screen.viewport_height}px; full content height in the PNG: ${screen.height}px. Preserve scrolling content.
${screen.intent}
${screen.viewport === 'mobile' ? 'Use the one-column mobile layouts and wrapped controls specified in DESIGN.md. Do not shrink desktop text or create horizontal overflow.' : 'Use the centered shell and desktop column proportions in DESIGN.md. Preserve the generous whitespace.'}
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
${screen.copy}
\`\`\`
`).join('');
}
