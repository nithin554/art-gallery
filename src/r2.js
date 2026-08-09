import { R2_CONFIG } from './config.js';

/**
 * Cloudflare R2 bucket client.
 *
 * The bucket is **public**, so images are served at their public URLs. The list
 * of object keys is supplied by a small Cloudflare Worker (`/worker`) that the
 * browser queries for the current contents of the `art` folder.
 */

/** If the bucket URL/list URL/folder aren't configured yet. */
export function isConfigured() {
  return (
    R2_CONFIG.bucketUrl &&
    R2_CONFIG.bucketUrl !== 'YOUR_R2_PUBLIC_URL' &&
    R2_CONFIG.listUrl &&
    R2_CONFIG.listUrl !== 'YOUR_WORKER_LIST_URL' &&
    R2_CONFIG.folder
  );
}

/** Build the full bucket base + folder URL, e.g. https://cdn.example.com/art */
function folderUrl() {
  return `${R2_CONFIG.bucketUrl.replace(/\/+$/, '')}/${R2_CONFIG.folder.replace(/^\/+|\/+$/g, '')}`;
}

/** Build the public URL for a single object key inside the folder. */
export function objectUrl(key) {
  const base = `${folderUrl()}/${key.replace(/^\/+/, '')}`;
  return R2_CONFIG.sizeSuffix ? `${base}${R2_CONFIG.sizeSuffix}` : base;
}

/**
 * Query the listing Worker for the object keys, then resolve to a list of
 * artworks.
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
