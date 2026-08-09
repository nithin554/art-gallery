/**
 * Cloudflare R2 bucket configuration.
 *
 * This gallery reads artworks from a **public** Cloudflare R2 bucket.
 * Upload your image files into the `art` folder, then the site discovers the
 * files via a small **Cloudflare Worker** (see `/worker`) that lists the
 * bucket's objects and returns their keys as JSON.
 *
 * Set-up:
 *   1. Create an R2 bucket and make it **public** (or attach a custom domain).
 *   2. Upload your artworks to the `art/` folder.
 *   3. Deploy the listing Worker (see `/worker` and README) to get its URL.
 *   4. Set `bucketUrl` to your public bucket base URL and `listUrl` to the
 *      Worker's URL below.
 *
 * The site fetches `listUrl`, gets the object keys, and renders each file as a
 * framed artwork.
 */
export const R2_CONFIG = {
  /** Public base URL of your R2 bucket (with trailing slash stripped). */
  bucketUrl: 'https://pub-480c51a26bb64a9fbf5faa596aaf0468.r2.dev',

  /** URL of the listing Worker that returns the object keys as JSON. */
  listUrl: 'https://art-gallery-42d5.nithinneeraj60.workers.dev',

  /** Folder inside the bucket that holds the artworks. */
  folder: 'art',

  /** Optional size hint appended to image URLs (e.g. '?w=2048'). Leave '' to skip. */
  sizeSuffix: ''
};
