# RETREST — Stitch screen prompts

Token lock: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`. Use [DESIGN.md](./DESIGN.md) and [tokens.json](./tokens.json) as the design authority. The manifest maps each HTML/PNG pair to its source and viewport. All six reference views below are from the current Vite starter, including one component-state sheet.

## Shared instruction for every generation or edit

Attach DESIGN.md, the individual HTML screen and its PNG. Reproduce the supplied layout and content at the requested width using the exact semantic colors, Inter typography, spacing, radii and component states. Build editable elements and reusable components in the Stitch editor. Uploaded HTML documents and images are references; they are not automatically editable generated screens. Do not import the gallery as a screen. Do not add fictitious payment, balance, transaction or subscription functionality. Keep desktop/mobile and Light/Dark variants as separately named screens. If a reference cannot be attached in your editor, paste the relevant spec and exact copy and use the PNG as the visual reference.

For edits, prepend: “Edit only [requested component/change]. Preserve all other layout, copy, state, Inter metrics, and token values from DESIGN.md. Return the named variant and explain any requested change that conflicts with the design system.” Resolve token changes in the source and regenerate this package before handing off accepted changes.

## Screen-specific prompts

### RETREST / Sign in / Light / desktop

- Stable variant ID: `login-light-desktop`
- HTML reference: [screens/login-light-desktop.html](./screens/login-light-desktop.html)
- Image reference: [screenshots/login-light-desktop.png](./screenshots/login-light-desktop.png)
- Source: frontend; components: WorkspaceLayout / AuthCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Sign in / Light / desktop” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: light. Target viewport: 1440 × 1000px; full content height in the PNG: 1000px. Preserve scrolling content.
The signed-out workspace with email/password sign-in and a link to signup. Account access is configured; fields are empty.
Use the centered shell and desktop column proportions in DESIGN.md. Preserve the generous whitespace.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☾
Dark mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

A LITTLE MORE PEACE OF MIND
Welcome back.

Sign in to your personal workspace.

Email address
Password
Sign in
New here? Create an account
RETREST · A calmer way to take control.
```

### RETREST / Sign in / Light / mobile

- Stable variant ID: `login-light-mobile`
- HTML reference: [screens/login-light-mobile.html](./screens/login-light-mobile.html)
- Image reference: [screenshots/login-light-mobile.png](./screenshots/login-light-mobile.png)
- Source: frontend; components: WorkspaceLayout / AuthCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Sign in / Light / mobile” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: light. Target viewport: 390 × 844px; full content height in the PNG: 1040px. Preserve scrolling content.
The signed-out workspace with email/password sign-in and a link to signup. Account access is configured; fields are empty.
Use the one-column mobile layouts and wrapped controls specified in DESIGN.md. Do not shrink desktop text or create horizontal overflow.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☾
Dark mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

A LITTLE MORE PEACE OF MIND
Welcome back.

Sign in to your personal workspace.

Email address
Password
Sign in
New here? Create an account
RETREST · A calmer way to take control.
```

### RETREST / Sign in / Dark / desktop

- Stable variant ID: `login-dark-desktop`
- HTML reference: [screens/login-dark-desktop.html](./screens/login-dark-desktop.html)
- Image reference: [screenshots/login-dark-desktop.png](./screenshots/login-dark-desktop.png)
- Source: frontend; components: WorkspaceLayout / AuthCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Sign in / Dark / desktop” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: dark. Target viewport: 1440 × 1000px; full content height in the PNG: 1000px. Preserve scrolling content.
The signed-out workspace with email/password sign-in and a link to signup. Account access is configured; fields are empty.
Use the centered shell and desktop column proportions in DESIGN.md. Preserve the generous whitespace.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☀
Light mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

A LITTLE MORE PEACE OF MIND
Welcome back.

Sign in to your personal workspace.

Email address
Password
Sign in
New here? Create an account
RETREST · A calmer way to take control.
```

### RETREST / Sign in / Dark / mobile

- Stable variant ID: `login-dark-mobile`
- HTML reference: [screens/login-dark-mobile.html](./screens/login-dark-mobile.html)
- Image reference: [screenshots/login-dark-mobile.png](./screenshots/login-dark-mobile.png)
- Source: frontend; components: WorkspaceLayout / AuthCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Sign in / Dark / mobile” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: dark. Target viewport: 390 × 844px; full content height in the PNG: 1040px. Preserve scrolling content.
The signed-out workspace with email/password sign-in and a link to signup. Account access is configured; fields are empty.
Use the one-column mobile layouts and wrapped controls specified in DESIGN.md. Do not shrink desktop text or create horizontal overflow.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☀
Light mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

A LITTLE MORE PEACE OF MIND
Welcome back.

Sign in to your personal workspace.

Email address
Password
Sign in
New here? Create an account
RETREST · A calmer way to take control.
```

### RETREST / Create account / Light / desktop

- Stable variant ID: `signup-light-desktop`
- HTML reference: [screens/signup-light-desktop.html](./screens/signup-light-desktop.html)
- Image reference: [screenshots/signup-light-desktop.png](./screenshots/signup-light-desktop.png)
- Source: frontend; components: WorkspaceLayout / AuthCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Create account / Light / desktop” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: light. Target viewport: 1440 × 1000px; full content height in the PNG: 1000px. Preserve scrolling content.
The same signed-out workspace with name, email and password inputs, Create account, and a link back to sign-in.
Use the centered shell and desktop column proportions in DESIGN.md. Preserve the generous whitespace.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☾
Dark mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

A LITTLE MORE PEACE OF MIND
Make room for better.

Create your RETREST account.

Your name
Email address
Password
Create account
Already have an account? Sign in
RETREST · A calmer way to take control.
```

### RETREST / Create account / Light / mobile

- Stable variant ID: `signup-light-mobile`
- HTML reference: [screens/signup-light-mobile.html](./screens/signup-light-mobile.html)
- Image reference: [screenshots/signup-light-mobile.png](./screenshots/signup-light-mobile.png)
- Source: frontend; components: WorkspaceLayout / AuthCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Create account / Light / mobile” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: light. Target viewport: 390 × 844px; full content height in the PNG: 1140px. Preserve scrolling content.
The same signed-out workspace with name, email and password inputs, Create account, and a link back to sign-in.
Use the one-column mobile layouts and wrapped controls specified in DESIGN.md. Do not shrink desktop text or create horizontal overflow.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☾
Dark mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

A LITTLE MORE PEACE OF MIND
Make room for better.

Create your RETREST account.

Your name
Email address
Password
Create account
Already have an account? Sign in
RETREST · A calmer way to take control.
```

### RETREST / Create account / Dark / desktop

- Stable variant ID: `signup-dark-desktop`
- HTML reference: [screens/signup-dark-desktop.html](./screens/signup-dark-desktop.html)
- Image reference: [screenshots/signup-dark-desktop.png](./screenshots/signup-dark-desktop.png)
- Source: frontend; components: WorkspaceLayout / AuthCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Create account / Dark / desktop” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: dark. Target viewport: 1440 × 1000px; full content height in the PNG: 1000px. Preserve scrolling content.
The same signed-out workspace with name, email and password inputs, Create account, and a link back to sign-in.
Use the centered shell and desktop column proportions in DESIGN.md. Preserve the generous whitespace.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☀
Light mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

A LITTLE MORE PEACE OF MIND
Make room for better.

Create your RETREST account.

Your name
Email address
Password
Create account
Already have an account? Sign in
RETREST · A calmer way to take control.
```

### RETREST / Create account / Dark / mobile

- Stable variant ID: `signup-dark-mobile`
- HTML reference: [screens/signup-dark-mobile.html](./screens/signup-dark-mobile.html)
- Image reference: [screenshots/signup-dark-mobile.png](./screenshots/signup-dark-mobile.png)
- Source: frontend; components: WorkspaceLayout / AuthCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Create account / Dark / mobile” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: dark. Target viewport: 390 × 844px; full content height in the PNG: 1140px. Preserve scrolling content.
The same signed-out workspace with name, email and password inputs, Create account, and a link back to sign-in.
Use the one-column mobile layouts and wrapped controls specified in DESIGN.md. Do not shrink desktop text or create horizontal overflow.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☀
Light mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

A LITTLE MORE PEACE OF MIND
Make room for better.

Create your RETREST account.

Your name
Email address
Password
Create account
Already have an account? Sign in
RETREST · A calmer way to take control.
```

### RETREST / Personal profile / Light / desktop

- Stable variant ID: `profile-light-desktop`
- HTML reference: [screens/profile-light-desktop.html](./screens/profile-light-desktop.html)
- Image reference: [screenshots/profile-light-desktop.png](./screenshots/profile-light-desktop.png)
- Source: frontend; components: WorkspaceLayout / ProfileCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Personal profile / Light / desktop” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: light. Target viewport: 1440 × 1000px; full content height in the PNG: 1000px. Preserve scrolling content.
The signed-in workspace, with fictional alex@example.test, a Sign out action, and an editable display name of Alex Morgan.
Use the centered shell and desktop column proportions in DESIGN.md. Preserve the generous whitespace.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☾
Dark mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

Signed in as alex@example.test

Sign out
YOUR PERSONAL SPACE
A fresh start.

Set the name you’d like to see in your workspace.

Display name
Save profile
RETREST · A calmer way to take control.
```

### RETREST / Personal profile / Light / mobile

- Stable variant ID: `profile-light-mobile`
- HTML reference: [screens/profile-light-mobile.html](./screens/profile-light-mobile.html)
- Image reference: [screenshots/profile-light-mobile.png](./screenshots/profile-light-mobile.png)
- Source: frontend; components: WorkspaceLayout / ProfileCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Personal profile / Light / mobile” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: light. Target viewport: 390 × 844px; full content height in the PNG: 1012px. Preserve scrolling content.
The signed-in workspace, with fictional alex@example.test, a Sign out action, and an editable display name of Alex Morgan.
Use the one-column mobile layouts and wrapped controls specified in DESIGN.md. Do not shrink desktop text or create horizontal overflow.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☾
Dark mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

Signed in as alex@example.test

Sign out
YOUR PERSONAL SPACE
A fresh start.

Set the name you’d like to see in your workspace.

Display name
Save profile
RETREST · A calmer way to take control.
```

### RETREST / Personal profile / Dark / desktop

- Stable variant ID: `profile-dark-desktop`
- HTML reference: [screens/profile-dark-desktop.html](./screens/profile-dark-desktop.html)
- Image reference: [screenshots/profile-dark-desktop.png](./screenshots/profile-dark-desktop.png)
- Source: frontend; components: WorkspaceLayout / ProfileCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Personal profile / Dark / desktop” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: dark. Target viewport: 1440 × 1000px; full content height in the PNG: 1000px. Preserve scrolling content.
The signed-in workspace, with fictional alex@example.test, a Sign out action, and an editable display name of Alex Morgan.
Use the centered shell and desktop column proportions in DESIGN.md. Preserve the generous whitespace.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☀
Light mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

Signed in as alex@example.test

Sign out
YOUR PERSONAL SPACE
A fresh start.

Set the name you’d like to see in your workspace.

Display name
Save profile
RETREST · A calmer way to take control.
```

### RETREST / Personal profile / Dark / mobile

- Stable variant ID: `profile-dark-mobile`
- HTML reference: [screens/profile-dark-mobile.html](./screens/profile-dark-mobile.html)
- Image reference: [screenshots/profile-dark-mobile.png](./screenshots/profile-dark-mobile.png)
- Source: frontend; components: WorkspaceLayout / ProfileCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Personal profile / Dark / mobile” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: dark. Target viewport: 390 × 844px; full content height in the PNG: 1012px. Preserve scrolling content.
The signed-in workspace, with fictional alex@example.test, a Sign out action, and an editable display name of Alex Morgan.
Use the one-column mobile layouts and wrapped controls specified in DESIGN.md. Do not shrink desktop text or create horizontal overflow.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☀
Light mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

Signed in as alex@example.test

Sign out
YOUR PERSONAL SPACE
A fresh start.

Set the name you’d like to see in your workspace.

Display name
Save profile
RETREST · A calmer way to take control.
```

### RETREST / Offline workspace / Light / desktop

- Stable variant ID: `offline-light-desktop`
- HTML reference: [screens/offline-light-desktop.html](./screens/offline-light-desktop.html)
- Image reference: [screenshots/offline-light-desktop.png](./screenshots/offline-light-desktop.png)
- Source: frontend; components: WorkspaceLayout / PwaStatus / AuthCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Offline workspace / Light / desktop” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: light. Target viewport: 1440 × 1000px; full content height in the PNG: 1000px. Preserve scrolling content.
The cached signed-out app shell. Include the actual offline notice above the sign-in form. Account changes need a connection; no cached profile, balance or offline transaction is shown.
Use the centered shell and desktop column proportions in DESIGN.md. Preserve the generous whitespace.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☾
Dark mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

You’re offline. The app is available; account changes need a connection.

A LITTLE MORE PEACE OF MIND
Welcome back.

Sign in to your personal workspace.

Email address
Password
Sign in
New here? Create an account
RETREST · A calmer way to take control.
```

### RETREST / Offline workspace / Light / mobile

- Stable variant ID: `offline-light-mobile`
- HTML reference: [screens/offline-light-mobile.html](./screens/offline-light-mobile.html)
- Image reference: [screenshots/offline-light-mobile.png](./screenshots/offline-light-mobile.png)
- Source: frontend; components: WorkspaceLayout / PwaStatus / AuthCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Offline workspace / Light / mobile” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: light. Target viewport: 390 × 844px; full content height in the PNG: 1144px. Preserve scrolling content.
The cached signed-out app shell. Include the actual offline notice above the sign-in form. Account changes need a connection; no cached profile, balance or offline transaction is shown.
Use the one-column mobile layouts and wrapped controls specified in DESIGN.md. Do not shrink desktop text or create horizontal overflow.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☾
Dark mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

You’re offline. The app is available; account changes need a connection.

A LITTLE MORE PEACE OF MIND
Welcome back.

Sign in to your personal workspace.

Email address
Password
Sign in
New here? Create an account
RETREST · A calmer way to take control.
```

### RETREST / Offline workspace / Dark / desktop

- Stable variant ID: `offline-dark-desktop`
- HTML reference: [screens/offline-dark-desktop.html](./screens/offline-dark-desktop.html)
- Image reference: [screenshots/offline-dark-desktop.png](./screenshots/offline-dark-desktop.png)
- Source: frontend; components: WorkspaceLayout / PwaStatus / AuthCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Offline workspace / Dark / desktop” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: dark. Target viewport: 1440 × 1000px; full content height in the PNG: 1000px. Preserve scrolling content.
The cached signed-out app shell. Include the actual offline notice above the sign-in form. Account changes need a connection; no cached profile, balance or offline transaction is shown.
Use the centered shell and desktop column proportions in DESIGN.md. Preserve the generous whitespace.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☀
Light mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

You’re offline. The app is available; account changes need a connection.

A LITTLE MORE PEACE OF MIND
Welcome back.

Sign in to your personal workspace.

Email address
Password
Sign in
New here? Create an account
RETREST · A calmer way to take control.
```

### RETREST / Offline workspace / Dark / mobile

- Stable variant ID: `offline-dark-mobile`
- HTML reference: [screens/offline-dark-mobile.html](./screens/offline-dark-mobile.html)
- Image reference: [screenshots/offline-dark-mobile.png](./screenshots/offline-dark-mobile.png)
- Source: frontend; components: WorkspaceLayout / PwaStatus / AuthCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Offline workspace / Dark / mobile” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: dark. Target viewport: 390 × 844px; full content height in the PNG: 1144px. Preserve scrolling content.
The cached signed-out app shell. Include the actual offline notice above the sign-in form. Account changes need a connection; no cached profile, balance or offline transaction is shown.
Use the one-column mobile layouts and wrapped controls specified in DESIGN.md. Do not shrink desktop text or create horizontal overflow.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☀
Light mode
Theme preference
System
Light
Dark
Your money. Your rules.
A little more
financial peace.

One place to begin taking care of your recurring payments. A space that feels like you.

You’re offline. The app is available; account changes need a connection.

A LITTLE MORE PEACE OF MIND
Welcome back.

Sign in to your personal workspace.

Email address
Password
Sign in
New here? Create an account
RETREST · A calmer way to take control.
```

### RETREST / Marketing landing page / Light / desktop

- Stable variant ID: `landing-light-desktop`
- HTML reference: [screens/landing-light-desktop.html](./screens/landing-light-desktop.html)
- Image reference: [screenshots/landing-light-desktop.png](./screenshots/landing-light-desktop.png)
- Source: landing-page; components: Landing App / FeatureCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Marketing landing page / Light / desktop” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: light. Target viewport: 1440 × 1000px; full content height in the PNG: 1578px. Preserve scrolling content.
The complete standalone marketing page: navigation and theme controls, two-column hero, product preview, three feature cards, closing CTA and footer. Capture the entire scrollable page.
Use the centered shell and desktop column proportions in DESIGN.md. Preserve the generous whitespace.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☾
Dark mode
Theme preference
System
Light
Dark
Open app ↗
YOUR MONEY. YOUR RULES.
Make room
for peace.

A calmer home for your recurring payments. Start with your own space, then build the habits that put you in control.

Get started
→
Explore RETREST

A new beginning for your financial routine.

A little more clarity
01 / Your space
RETREST
Financial peace,
on your terms.
Designed around you.
One clear view
Less noise
A familiar rhythm
More control

An early look at the experience we’re building.

A THOUGHTFUL FOUNDATION
A space that grows with you.
01 / PERSONAL
Your own starting point.

Create your account and make your workspace feel like you.

02 / COMFORTABLE
At home, day or night.

Choose a light or dark appearance that suits your rhythm.

03 / ALWAYS NEARBY
A place on your home screen.

Install RETREST and return to your space, even when you’re offline.

Your next chapter starts here.

Bring a little more calm to the everyday.

Open your workspace →
© 2026 RETREST
A little more financial peace.
```

### RETREST / Marketing landing page / Light / mobile

- Stable variant ID: `landing-light-mobile`
- HTML reference: [screens/landing-light-mobile.html](./screens/landing-light-mobile.html)
- Image reference: [screenshots/landing-light-mobile.png](./screenshots/landing-light-mobile.png)
- Source: landing-page; components: Landing App / FeatureCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Marketing landing page / Light / mobile” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: light. Target viewport: 390 × 844px; full content height in the PNG: 2386px. Preserve scrolling content.
The complete standalone marketing page: navigation and theme controls, two-column hero, product preview, three feature cards, closing CTA and footer. Capture the entire scrollable page.
Use the one-column mobile layouts and wrapped controls specified in DESIGN.md. Do not shrink desktop text or create horizontal overflow.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☾
Dark mode
Theme preference
System
Light
Dark
Open app ↗
YOUR MONEY. YOUR RULES.
Make room
for peace.

A calmer home for your recurring payments. Start with your own space, then build the habits that put you in control.

Get started
→
Explore RETREST

A new beginning for your financial routine.

A little more clarity
01 / Your space
RETREST
Financial peace,
on your terms.
Designed around you.
One clear view
Less noise
A familiar rhythm
More control

An early look at the experience we’re building.

A THOUGHTFUL FOUNDATION
A space that grows with you.
01 / PERSONAL
Your own starting point.

Create your account and make your workspace feel like you.

02 / COMFORTABLE
At home, day or night.

Choose a light or dark appearance that suits your rhythm.

03 / ALWAYS NEARBY
A place on your home screen.

Install RETREST and return to your space, even when you’re offline.

Your next chapter starts here.

Bring a little more calm to the everyday.

Open your workspace →
© 2026 RETREST
A little more financial peace.
```

### RETREST / Marketing landing page / Dark / desktop

- Stable variant ID: `landing-dark-desktop`
- HTML reference: [screens/landing-dark-desktop.html](./screens/landing-dark-desktop.html)
- Image reference: [screenshots/landing-dark-desktop.png](./screenshots/landing-dark-desktop.png)
- Source: landing-page; components: Landing App / FeatureCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Marketing landing page / Dark / desktop” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: dark. Target viewport: 1440 × 1000px; full content height in the PNG: 1578px. Preserve scrolling content.
The complete standalone marketing page: navigation and theme controls, two-column hero, product preview, three feature cards, closing CTA and footer. Capture the entire scrollable page.
Use the centered shell and desktop column proportions in DESIGN.md. Preserve the generous whitespace.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☀
Light mode
Theme preference
System
Light
Dark
Open app ↗
YOUR MONEY. YOUR RULES.
Make room
for peace.

A calmer home for your recurring payments. Start with your own space, then build the habits that put you in control.

Get started
→
Explore RETREST

A new beginning for your financial routine.

A little more clarity
01 / Your space
RETREST
Financial peace,
on your terms.
Designed around you.
One clear view
Less noise
A familiar rhythm
More control

An early look at the experience we’re building.

A THOUGHTFUL FOUNDATION
A space that grows with you.
01 / PERSONAL
Your own starting point.

Create your account and make your workspace feel like you.

02 / COMFORTABLE
At home, day or night.

Choose a light or dark appearance that suits your rhythm.

03 / ALWAYS NEARBY
A place on your home screen.

Install RETREST and return to your space, even when you’re offline.

Your next chapter starts here.

Bring a little more calm to the everyday.

Open your workspace →
© 2026 RETREST
A little more financial peace.
```

### RETREST / Marketing landing page / Dark / mobile

- Stable variant ID: `landing-dark-mobile`
- HTML reference: [screens/landing-dark-mobile.html](./screens/landing-dark-mobile.html)
- Image reference: [screenshots/landing-dark-mobile.png](./screenshots/landing-dark-mobile.png)
- Source: landing-page; components: Landing App / FeatureCard.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Marketing landing page / Dark / mobile” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: dark. Target viewport: 390 × 844px; full content height in the PNG: 2386px. Preserve scrolling content.
The complete standalone marketing page: navigation and theme controls, two-column hero, product preview, three feature cards, closing CTA and footer. Capture the entire scrollable page.
Use the one-column mobile layouts and wrapped controls specified in DESIGN.md. Do not shrink desktop text or create horizontal overflow.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☀
Light mode
Theme preference
System
Light
Dark
Open app ↗
YOUR MONEY. YOUR RULES.
Make room
for peace.

A calmer home for your recurring payments. Start with your own space, then build the habits that put you in control.

Get started
→
Explore RETREST

A new beginning for your financial routine.

A little more clarity
01 / Your space
RETREST
Financial peace,
on your terms.
Designed around you.
One clear view
Less noise
A familiar rhythm
More control

An early look at the experience we’re building.

A THOUGHTFUL FOUNDATION
A space that grows with you.
01 / PERSONAL
Your own starting point.

Create your account and make your workspace feel like you.

02 / COMFORTABLE
At home, day or night.

Choose a light or dark appearance that suits your rhythm.

03 / ALWAYS NEARBY
A place on your home screen.

Install RETREST and return to your space, even when you’re offline.

Your next chapter starts here.

Bring a little more calm to the everyday.

Open your workspace →
© 2026 RETREST
A little more financial peace.
```

### RETREST / Component states / Light / desktop

- Stable variant ID: `components-light-desktop`
- HTML reference: [screens/components-light-desktop.html](./screens/components-light-desktop.html)
- Image reference: [screenshots/components-light-desktop.png](./screenshots/components-light-desktop.png)
- Source: shared reference; components: ThemeControl / AuthCard / ProfileCard / PwaStatus.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Component states / Light / desktop” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: light. Target viewport: 1440 × 1000px; full content height in the PNG: 2097px. Preserve scrolling content.
A reference sheet, not a new product route. Show primary/quiet/hover/focus/disabled/loading controls, labeled inputs, error/success copy, notices, badges, theme controls, auth/profile cards and PWA update/dismissal actions.
Use the centered shell and desktop column proportions in DESIGN.md. Preserve the generous whitespace.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☾
Dark mode
Theme preference
System
Light
Dark
DESIGN SYSTEM REFERENCE
Components and states.

Reference sheet for the current starter. Examples use fictional data.

Buttons and inputs
Primary
Quiet
Hover
Focus
Disabled
Please wait…
Saving…
Default input
Focus input
Error message
Unable to sign in. Please try again.

Check your email to confirm your account, then sign in.

Loading your profile…

Opening your workspace…

Account access is awaiting setup. You can still explore the app and change its appearance.

Offline support could not start. Reload while connected to try again.

Your money. Your rules.
REUSABLE EYEBROW
Install RETREST
A LITTLE MORE PEACE OF MIND
Welcome back.

Sign in to your personal workspace.

Email address
Password

Unable to sign in. Please try again.

Please wait…
New here? Create an account
YOUR PERSONAL SPACE
A fresh start.

Set the name you’d like to see in your workspace.

Display name
Save profile

Your profile is saved.

PWA notices and update states
Ready to open offline.
Dismiss
A new version is ready. Save your changes first.
Update app
Later
RETREST · Shared component reference.
```

### RETREST / Component states / Light / mobile

- Stable variant ID: `components-light-mobile`
- HTML reference: [screens/components-light-mobile.html](./screens/components-light-mobile.html)
- Image reference: [screenshots/components-light-mobile.png](./screenshots/components-light-mobile.png)
- Source: shared reference; components: ThemeControl / AuthCard / ProfileCard / PwaStatus.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Component states / Light / mobile” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: light. Target viewport: 390 × 844px; full content height in the PNG: 3012px. Preserve scrolling content.
A reference sheet, not a new product route. Show primary/quiet/hover/focus/disabled/loading controls, labeled inputs, error/success copy, notices, badges, theme controls, auth/profile cards and PWA update/dismissal actions.
Use the one-column mobile layouts and wrapped controls specified in DESIGN.md. Do not shrink desktop text or create horizontal overflow.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☾
Dark mode
Theme preference
System
Light
Dark
DESIGN SYSTEM REFERENCE
Components and states.

Reference sheet for the current starter. Examples use fictional data.

Buttons and inputs
Primary
Quiet
Hover
Focus
Disabled
Please wait…
Saving…
Default input
Focus input
Error message
Unable to sign in. Please try again.

Check your email to confirm your account, then sign in.

Loading your profile…

Opening your workspace…

Account access is awaiting setup. You can still explore the app and change its appearance.

Offline support could not start. Reload while connected to try again.

Your money. Your rules.
REUSABLE EYEBROW
Install RETREST
A LITTLE MORE PEACE OF MIND
Welcome back.

Sign in to your personal workspace.

Email address
Password

Unable to sign in. Please try again.

Please wait…
New here? Create an account
YOUR PERSONAL SPACE
A fresh start.

Set the name you’d like to see in your workspace.

Display name
Save profile

Your profile is saved.

PWA notices and update states
Ready to open offline.
Dismiss
A new version is ready. Save your changes first.
Update app
Later
RETREST · Shared component reference.
```

### RETREST / Component states / Dark / desktop

- Stable variant ID: `components-dark-desktop`
- HTML reference: [screens/components-dark-desktop.html](./screens/components-dark-desktop.html)
- Image reference: [screenshots/components-dark-desktop.png](./screenshots/components-dark-desktop.png)
- Source: shared reference; components: ThemeControl / AuthCard / ProfileCard / PwaStatus.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Component states / Dark / desktop” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: dark. Target viewport: 1440 × 1000px; full content height in the PNG: 2097px. Preserve scrolling content.
A reference sheet, not a new product route. Show primary/quiet/hover/focus/disabled/loading controls, labeled inputs, error/success copy, notices, badges, theme controls, auth/profile cards and PWA update/dismissal actions.
Use the centered shell and desktop column proportions in DESIGN.md. Preserve the generous whitespace.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☀
Light mode
Theme preference
System
Light
Dark
DESIGN SYSTEM REFERENCE
Components and states.

Reference sheet for the current starter. Examples use fictional data.

Buttons and inputs
Primary
Quiet
Hover
Focus
Disabled
Please wait…
Saving…
Default input
Focus input
Error message
Unable to sign in. Please try again.

Check your email to confirm your account, then sign in.

Loading your profile…

Opening your workspace…

Account access is awaiting setup. You can still explore the app and change its appearance.

Offline support could not start. Reload while connected to try again.

Your money. Your rules.
REUSABLE EYEBROW
Install RETREST
A LITTLE MORE PEACE OF MIND
Welcome back.

Sign in to your personal workspace.

Email address
Password

Unable to sign in. Please try again.

Please wait…
New here? Create an account
YOUR PERSONAL SPACE
A fresh start.

Set the name you’d like to see in your workspace.

Display name
Save profile

Your profile is saved.

PWA notices and update states
Ready to open offline.
Dismiss
A new version is ready. Save your changes first.
Update app
Later
RETREST · Shared component reference.
```

### RETREST / Component states / Dark / mobile

- Stable variant ID: `components-dark-mobile`
- HTML reference: [screens/components-dark-mobile.html](./screens/components-dark-mobile.html)
- Image reference: [screenshots/components-dark-mobile.png](./screenshots/components-dark-mobile.png)
- Source: shared reference; components: ThemeControl / AuthCard / ProfileCard / PwaStatus.
- Token SHA-256: `98dd5d963c682683e02f25da4e861a66b471e0cab47c955746a71a326c65ca04`

```text
Create or edit “RETREST / Component states / Dark / mobile” for RETREST.
Use the attached DESIGN.md without substituting colors, fonts or radii.
Theme: dark. Target viewport: 390 × 844px; full content height in the PNG: 3012px. Preserve scrolling content.
A reference sheet, not a new product route. Show primary/quiet/hover/focus/disabled/loading controls, labeled inputs, error/success copy, notices, badges, theme controls, auth/profile cards and PWA update/dismissal actions.
Use the one-column mobile layouts and wrapped controls specified in DESIGN.md. Do not shrink desktop text or create horizontal overflow.
Keep all copy below exactly as shown, with the same hierarchy and controls.
Reference links in static HTML are local navigation conveniences; generated app CTAs should point to the frontend and preserve their labels.

VISIBLE COPY:
✓
RETREST
☀
Light mode
Theme preference
System
Light
Dark
DESIGN SYSTEM REFERENCE
Components and states.

Reference sheet for the current starter. Examples use fictional data.

Buttons and inputs
Primary
Quiet
Hover
Focus
Disabled
Please wait…
Saving…
Default input
Focus input
Error message
Unable to sign in. Please try again.

Check your email to confirm your account, then sign in.

Loading your profile…

Opening your workspace…

Account access is awaiting setup. You can still explore the app and change its appearance.

Offline support could not start. Reload while connected to try again.

Your money. Your rules.
REUSABLE EYEBROW
Install RETREST
A LITTLE MORE PEACE OF MIND
Welcome back.

Sign in to your personal workspace.

Email address
Password

Unable to sign in. Please try again.

Please wait…
New here? Create an account
YOUR PERSONAL SPACE
A fresh start.

Set the name you’d like to see in your workspace.

Display name
Save profile

Your profile is saved.

PWA notices and update states
Ready to open offline.
Dismiss
A new version is ready. Save your changes first.
Update app
Later
RETREST · Shared component reference.
```
