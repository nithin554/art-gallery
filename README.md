# The Gallery 🖼️

A beautiful, static art-gallery web site with a dark **museum wall** aesthetic.
It has **no backend** — photography is chosen directly from a visitor's Google
Photos library using the client-side **Google Photos Picker API**
(`photospicker.googleapis.com`).

![style](https://img.shields.io/badge/style-museum%2Fdark-gold)

## Features

- 🖼️ **Framed museum wall** — each photo is matted, framed, and hung with subtle
  stagger and tilt for a hand-hung gallery feel.
- 🏛️ **Dark theme** with warm oak frames, ivory mats, and brass/gold nameplates.
- 🔎 **Lightbox viewer** with keyboard navigation (← → and Esc) and prev/next.
- 💾 **Persistent wall** — your curated collection is saved to `localStorage`, so
  it survives page reloads with no backend.
- ⚡ **Static & fast** — built with Vite, deploys to any static host.

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## Configuring the Google Photos Picker

This is a purely static site, so you must supply Google credentials. Edit
**[`src/config.js`](./src/config.js)** and set:

1. **`clientId`** — an OAuth 2.0 **Web Application** client ID.
2. (`apiKey` is optional for the REST calls used here but shown for reference.)

### Step-by-step

1. Go to the [Google Cloud Console](https://console.cloud.google.com) and create
   a project (or use one you already have).
2. **APIs & Services → Library** → enable the **Photos Picker API**.
3. (Optional) **APIs & Services → Credentials → Create credentials → API key**.
   Restrict the key to the *Photos Picker API* and to your HTTP referrers if you
   use key-based calls.
4. **Create credentials → OAuth client ID → Web application**. Enter your site in
   **Authorized JavaScript origins**:

   | Environment            | Origin                       |
   | ---------------------- | ---------------------------- |
   | Local dev (Vite)       | `http://localhost:5173`      |
   | Preview build (Vite)   | `http://localhost:4173`      |
   | Production (deployed)  | `https://yourdomain.com`     |

   Copy the **Client ID** that's generated.
5. Add the required scope to your OAuth **consent screen**:
   - `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`
6. Fill the **`clientId`** into **`src/config.js`**.

> 🔒 Because there is no backend, the client ID (and API key if used) ship to
> the browser. Always restrict any API key to your own domain.

### How the flow works

`chooseFromPhotos()` in [`src/picker.js`](./src/picker.js) implements the
client-side Photos Picker flow, which needs **no backend**:

1. `POST /v1/sessions` → creates a `PickingSession` (returns `id`, `pickerUri`,
   `pollingConfig`).
2. Opens `pickerUri` in a new tab (with `/autoclose`). The user picks photos in
   Google Photos.
3. Polls `GET /v1/sessions/{id}` using the API's recommended `pollInterval`
   until `mediaItemsSet` is `true`.
4. `GET /v1/mediaItems?sessionId=…` → returns the selected items with their
   thumbnail/base URLs.
5. `DELETE /v1/sessions/{id}` to clean up the session.

## Deploying

`npm run build` emits a fully static site into `dist/`. Host it anywhere static —
Netlify, Vercel, GitHub Pages, Cloudflare Pages, S3/CloudFront, etc.

### GitHub Pages (built-in CI/CD)

A workflow at **[`.github/workflows/pages.yml`](./.github/workflows/pages.yml)**
builds the site and deploys to GitHub Pages on every push to `main` (and on
manual dispatch). Pull requests are built as a compilation check but not
deployed.

To enable it:

1. **Push the current branch to GitHub** (the workflow lives in
   `.github/workflows/pages.yml`).
2. In the repo: **Settings → Pages → Source: GitHub Actions**. This tells
   GitHub to accept the deployment artifact the workflow uploads.
3. Push to `main` (or trigger **Actions → "Build & Deploy to GitHub Pages" →
   Run workflow**).

The deployment visits `https://<user>.github.io/<repo>/`.

#### How the base path works

Because a project page is served from a subpath
(`/art-gallery/`), the Vite config reads `REPO_NAME` at build time and prefixes
all asset URLs accordingly. The workflow sets it automatically from the repo
name. If you instead host on the root of a user/org pages site, build without
`REPO_NAME` (base falls back to `/`) or set `VITE_BASE` explicitly.

## Security note

The Photos Picker API is Google's recommended way to let users grant access to
a **selected subset** of their photos **without** giving a server access to
their entire Google Photos library. The picker opens in Google Photos, and the
user explicitly chooses which items to share. This keeps your site lightweight,
private, and backend-free.

## Branding & OAuth consent screen

Logo assets ship with the site:

- **`public/logo.svg`** — the app logo (museum-style mark), also used as the
  in-page `apple-touch-icon`.
- **`public/favicon.svg`** — the browser favicon.
- **`public/google-logo.png`** — auto-generated **120 × 120** PNG for Google's
  consent screen (produced at build time).
- **`public/favicon.png`** — auto-generated **32 × 32** PNG favicon fallback.

All are wired into [`index.html`](./index.html).

### Generating the PNGs

`npm run build` (and `npm run build:logos`) regenerates the PNGs from
`public/logo.svg` using a small script,
[`scripts/generate-logos.mjs`](./scripts/generate-logos.mjs), which shells out
to ImageMagick. If ImageMagick isn't installed, the PNGs are simply skipped and
the site still works (SVG favicon remains).

### Submitting the logo to Google's consent screen

Google requires (OAuth **consent screen** → **Branding** → **App logo**):

- **File type:** `.PNG` or `.JPG`
- **Dimensions:** square, **120 × 120 px**
- **Max size:** `1 MB`
- **Aspect ratio:** strictly square

Upload **`public/google-logo.png`** directly — it already meets these specs.

> Note: your `photospicker.mediaitems.readonly` scope is **sensitive**-categorized.
> For a **Testing**-mode app (≤100 users) no logo/verification is needed. To
> **Publish** for production, brand verification requires more than a logo — a
> verifiable homepage and a matching privacy policy on your verified domain
> must be linked from both the homepage and the consent screen.

## Legal pages

Two ready-to-customize legal pages are included and linked from the site
footer:

- **[`privacy.html`](./privacy.html)** — Privacy Policy
- **[`terms.html`](./terms.html)** — Terms of Service

Both are styled to match the dark museum theme and are emitted into `dist/`
during `npm run build` (see `vite.config.js`). For Google brand verification
you must:

1. Host these pages on the **same verified domain** as your homepage.
2. Link them from your **homepage** (already done in the footer).
3. Put the **same Privacy Policy URL** into the OAuth consent screen's
   **Privacy Policy** field.
4. Customize the contact details and any wording to reflect your real identity
   and practices.

---

Built with [Vite](https://vitejs.dev/).
