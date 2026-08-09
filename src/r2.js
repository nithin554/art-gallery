import { R2_CONFIG } from './config.js';

/**
 * Cloudflare R2 client.
 *
 * A Worker serves both the object listing (`GET listUrl`) and the image bytes
 * (`GET <imageBaseUrl>/img/<key>`). Images are served with CORS headers by the
 * Worker, so the browser loads them cross-origin without opaque-response
 * blocks (ERR_BLOCKED_BY_ORB).
 */

/** If the worker list URL/image base URL/folder aren't configured yet. */
export function isConfigured() {
  return (
    R2_CONFIG.listUrl &&
    R2_CONFIG.listUrl !== 'YOUR_WORKER_LIST_URL' &&
    R2_CONFIG.imageBaseUrl &&
    R2_CONFIG.imageBaseUrl !== 'YOUR_WORKER_ORIGIN' &&
    R2_CONFIG.folder
  );
}

/** Build the Worker URL that serves a single object's bytes. */
export function objectUrl(key) {
  return `${R2_CONFIG.imageBaseUrl.replace(/\/+$/, '')}/img/${String(
    key
  ).replace(/^\/+/, '')}`;
}

/**
 * A small, resized variant of an image, for the wall grid. The worker converts
 * it to a width-800 webp, keeping the first load fast even for large photos.
 */
export function thumbnailUrl(key) {
  return `${objectUrl(key)}?w=800`;
}

/**
 * Query the Worker for the object keys, then resolve to a list of artworks.
 *
 * Each item is shaped like:
 *   { id, name, url }
 * where `id` is the full object key (for stable lightbox navigation) and `name`
 * is the same key (used to build the plaque label).
 *
 * @returns {Promise<Array<{id: string, name: string, url: string}>>}
 */
export async function loadGallery() {
  const response = await fetch(R2_CONFIG.listUrl, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Could not list bucket objects (HTTP ${response.status}).`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The listing worker did not return valid JSON.');
  }

  const keys = Array.isArray(data?.files) ? data.files : [];
  const seen = new Set();
  const items = [];

  for (const key of keys) {
    if (typeof key !== 'string' || !key.trim()) continue;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      id: key,
      name: key,
      url: objectUrl(key)
    });
  }

  return items;
}
