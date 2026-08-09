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
- ☁️ **R2-backed** — the wall pulls every file from an `art` folder in a public
  Cloudflare R2 bucket.
- ⚡ **Static & fast** — built with Vite, deploys to any static host.

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## Setting up Cloudflare R2

The gallery reads artworks from a **public** R2 bucket, and the *list* of files
comes from a small **Cloudflare Worker** that lists the bucket's `art` folder.
Everything is served from Cloudflare with no backend to maintain and no secrets
shipped to the browser.

### Step 1 — Create & fill the bucket

1. In the Cloudflare dashboard, **R2 → Create bucket** (e.g. `art-gallery-bucket`).
2. Upload your artworks into the **`art`** folder. Any image type the browser
   can render works (jpg, jpeg, png, webp, avif, gif, …).
3. Make the bucket **public**: **R2 → your bucket → Settings → Public access →
   Allow access** (or attach a custom domain). Copy the public base URL, e.g.

   ```
   https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
   ```

### Step 2 — Deploy the listing Worker

The [`worker/`](./worker) directory contains a Cloudflare Worker that lists the
objects under `art/` and returns their keys as JSON. It uses an **R2 bucket
binding**, so no credentials ever reach the browser.

1. Open **[`worker/wrangler.toml`](./worker/wrangler.toml)`** and set your bucket
   name in the `bucket_name` field.

2. Deploy it **one of two ways** (below) to get a URL like
   `https://art-gallery-list.<you>.workers.dev`. A `GET` should return:

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
  bucketUrl: 'https://pub-xxxxxxxxxxxxx.r2.dev', // public bucket base URL
  listUrl: 'https://art-gallery-list.<you>.workers.dev', // your Worker URL
  folder: 'art',
  sizeSuffix: ''
};
```

`sizeSuffix` is optional — set it to e.g. `'?w=2048'` if your R2 side setup
(like an image transform) supports a size hint; otherwise leave it `''`.

### How it works

[`src/r2.js`](./src/r2.js) queries the Worker's `listUrl`, gets the object keys,
then builds a public URL for each file (`<bucketUrl>/art/<key>`). The worker in
[`worker/src/index.js`](./worker/src/index.js) pages through the bucket with
`ART_BUCKET.list({ prefix: 'art/' })` and returns every key. [`src/main.js`](./src/main.js)
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

R2 object storage is served over HTTPS with your own credentials at rest. Making
the bucket public is fine for public gallery artwork — anyone with the URL can
view the objects, but no secrets are shipped to the browser and no API keys are
required client-side. For private collections, keep the bucket private and serve
it through a signed/authenticated Cloudflare Worker instead.

## Legal pages

Two ready-to-customize legal pages are included and linked from the site
footer:

- **[`privacy.html`](./privacy.html)** — Privacy Policy
- **[`terms.html`](./terms.html)** — Terms of Service

Both are styled to match the dark museum theme and are emitted into `dist/`
during `npm run build` (see `vite.config.js`).

---

Built with [Vite](https://vitejs.dev/).
