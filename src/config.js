/**
 * Cloudflare R2 configuration.
 *
 * This gallery reads artworks from a Cloudflare R2 bucket through a small
 * **Cloudflare Worker** (see `/worker`). The Worker:
 *
 *  - `GET listUrl`            → returns the object keys in the `art` folder,
 *                               e.g. { "files": ["sunset.jpg", ...] }
 *  - `GET <imageBaseUrl>/img/<key>` → streams the image bytes with CORS headers
 *                               so the browser can load them cross-origin.
 *
 * Set-up:
 *   1. Create an R2 bucket and upload your artworks into the `art` folder.
 *   2. Deploy the Worker (see `/worker` and README) to get its URL.
 *   3. Set `listUrl` to the Worker's URL and `imageBaseUrl` to its origin.
 *
 * The site fetches the listing from `listUrl`, then renders each file through
 * `imageBaseUrl`, avoiding the raw bucket origin (which can trip the browser's
 * opaque-response protections when CORS isn't configured on the bucket).
 */
export const R2_CONFIG = {
  /** URL of the Worker that returns the object keys as JSON (the listing). */
  listUrl: 'https://art-gallery-list.nithinneeraj60.workers.dev',

  /**
   * Base origin (scheme + host) of the Worker used to serve image bytes at
   * `/img/<key>`. Usually the same origin as listUrl.
   */
  imageBaseUrl: 'https://art-gallery-list.nithinneeraj60.workers.dev',

  /** Folder inside the bucket that holds the artworks. */
  folder: 'art'
};
