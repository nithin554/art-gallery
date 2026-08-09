# The Gallery 🖼️

A beautiful, static art-gallery web site with a dark **museum wall** aesthetic.
Artworks are read directly from a **Cloudflare R2 bucket** — no backend needed
for serving.

![style](https://img.shields.io/badge/style-museum%2Fdark-gold)

## Features

- 🖼️ **Framed museum wall** — each photo is matted, framed, and hung with subtle
  stagger and tilt for a hand-hung gallery feel.
- 🏛️ **Dark theme** with warm oak frames, ivory mats, and brass/gold nameplates.
- 🔎 **Lightbox viewer** with keyboard navigation (← → and Esc) and prev/next.
- 💾 **Persistent wall** — your curation is saved to `localStorage`, so it
  survives reloads.
- ☁️ **R2-backed** — the wall pulls every file from an `art` folder in a
  Cloudflare R2 bucket through a Worker.
- ⚡ **Static & fast** — built with Vite, deploys to any static host.

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## Setting up Cloudflare R2

The gallery serves its artworks from a **Cloudflare R2 bucket through a
Worker**. The Worker both *lists* the `art` folder and *streams* the image bytes
with CORS headers, so images load cross-origin without the browser blocking them
(`ERR_BLOCKED_BY_ORB`). Everything is served from Cloudflare with no backend to
maintain and no secrets shipped to the browser.

### Step 1 — Create & fill the bucket

1. In the Cloudflare dashboard, **R2 → Create bucket** (e.g. `art-gallery`).
2. Upload your artworks into the **`art`** folder. Any image type the browser
   can render works (jpg, jpeg, png, webp, avif, gif, …).

### Step 2 — Deploy the Worker

The [`worker/`](./worker) directory contains a Worker with three routes:

- `GET /` → the object listing: `{ "files": ["sunset.jpg", ...] }`
- `GET /img/<key>` → the image bytes (with `Content-Type` + CORS headers)
- `GET /img/<key>?w=<px>` → the image resized to that width (fast wall tiles)

It uses an **R2 bucket binding**, so no credentials ever reach the browser.
CORS is handled in the Worker itself, so you don't have to edit any CORS
settings on the bucket.

1. Open **[`worker/wrangler.toml`](./worker/wrangler.toml)`** and set your bucket
   name in the `bucket_name` field.

2. Deploy it **one of two ways** (below). After deploying, a `GET` on the root
   returns:

   ```json
   { "files": ["sunset-over-the-hills.jpg", "still-life.paint.jpeg"] }
   ```

   **Option A — from your machine:**

   ```bash
   npm install -D wrangler
   npx wrangler login
   npm run worker:deploy   # runs: wrangler deploy --config worker/wrangler.toml
   ```

   For local testing first: `npm run worker:dev`.

   **Option B — via GitHub Actions (automatic).** A workflow at
   **[`.github/workflows/deploy-worker.yml`](./.github/workflows/deploy-worker.yml)**
   deploys the worker with `cloudflare/wrangler-action` whenever you push
   changes to `worker/` on `main` (or manually via **Actions → "Deploy R2
   Listing Worker" → Run workflow**). It needs two repository secrets:
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (see "Automated worker
   deployment" below).

### Step 3 — Point the site at it

Edit **[`src/config.js`](./src/config.js)**:

```js
export const R2_CONFIG = {
  listUrl: 'https://art-gallery-list.<you>.workers.dev',        // listing + images
  imageBaseUrl: 'https://art-gallery-list.<you>.workers.dev',   // origin for /img/<key>
  folder: 'art'
};
```

`imageBaseUrl` is the scheme + host of the Worker and is usually just the origin
of `listUrl`. It's where `objectUrl` points for `/<imageBaseUrl>/img/<key>`.

### How it works

[`src/r2.js`](./src/r2.js) queries the Worker's `listUrl` for the object keys,
then builds each image URL as `<imageBaseUrl>/img/<key>`. The wall renders each
through a **resized thumbnail** (`?w=800`), while the lightbox loads the full
resolution. The worker in [`worker/src/index.js`](./worker/src/index.js) pages
through the bucket with `ART_BUCKET.list({ prefix: 'art/' })`, filters out
directory markers, and streams each object's bytes from `ART_BUCKET.get(key)`
with CORS headers. When a `w=` width is requested, it resizes the image at the
edge with Cloudflare's image pipeline (webp). [`src/main.js`](./src/main.js)
renders each as a framed artwork and stores the list in `localStorage` so the
wall keeps your chosen arrangement across reloads. The "Refresh from the bucket"
action re-queries the Worker to pick up newly added files.

> 💡 The site auto-loads the wall on first visit; on later visits it keeps the
> local arrangement (order, removals) you curated. Hit "Refresh from the bucket"
> to re-sync with the bucket's current contents.

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

### Automated worker deployment (GitHub Actions)

[`.github/workflows/deploy-worker.yml`](./.github/workflows/deploy-worker.yml)
deploys the R2 listing worker automatically with the **Cloudflare Wrangler
GitHub Action** — no need to edit the worker in the dashboard.

**Configuring the secrets** (once):

1. **Account ID:** Cloudflare dashboard → right sidebar → **My Profile → API
   Tokens** → copy your **Account ID** (or the badge on the account home).
2. **API token:** **API Tokens → Create Token →** choose the
   **"Edit Cloudflare Workers"** template (or create a custom token with the
   **`Workers Scripts: Edit`** permission on your account, plus **R2 Admin**
   as needed). Copy the token.
3. In your GitHub repo: **Settings → Secrets and variables → Actions → New
   repository secret** and add:
   - `CLOUDFLARE_ACCOUNT_ID` → your account ID
   - `CLOUDFLARE_API_TOKEN` → your token

**Triggers:** the workflow runs on push to `main` when files under `worker/`
(or the workflow itself) change, and on manual dispatch (**Actions → "Deploy R2
Listing Worker" → Run workflow**).

> 🔒 The `CLOUDFLARE_API_TOKEN` is stored as a GitHub secret and is only
> injected into the workflow runner — it is never shipped to the browser or
> committed to the repo.

## Security note

R2 object storage is served over HTTPS with your own credentials at rest. Images
are served through a Worker that returns them with CORS headers, so no CORS
settings need to be edited on the bucket itself and no API keys are required
client-side. For a private collection, keep the bucket non-public — the Worker
serves objects via its `ART_BUCKET` binding regardless of the bucket's public
access setting.

## Legal pages

Two ready-to-customize legal pages are included and linked from the site
footer:

- **[`privacy.html`](./privacy.html)** — Privacy Policy
- **[`terms.html`](./terms.html)** — Terms of Service

Both are styled to match the dark museum theme and are emitted into `dist/`
during `npm run build` (see `vite.config.js`).

---

Built with [Vite](https://vitejs.dev/).
