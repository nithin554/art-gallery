/**
 * art-gallery-worker — serves the gallery's R2 contents with CORS headers so
 * the static site can load them cross-origin (prevents ERR_BLOCKED_BY_ORB).
 *
 * Routes:
 *   GET /                  → JSON listing of objects in the `art` folder
 *                            { "files": ["sunset.jpg", ...] }
 *   GET /img/<key...>      → streams the image bytes for that object with a
 *                            correct Content-Type and Access-Control-Allow-Origin
 */

const ART_FOLDER = 'art';

/** CORS: allow the static site (any origin) to read both the listing and images. */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...CORS_HEADERS
    }
  });
}

/** Map common image extensions to a MIME type. */
const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml'
};

function mimeFor(key) {
  const ext = (key.split('.').pop() || '').toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

/**
 * List every object under the `art` folder.
 *
 * R2's bucket binding exposes `list({ prefix, delimiter })`. It is paginated,
 * so we keep calling until a returned list is truncated, then concatenate.
 *
 * `delimiter` is deliberately omitted so we get all keys (not just "directories").
 */
async function listFiles(bucket) {
  const files = [];
  let cursor;

  do {
    const listed = await bucket.list({
      prefix: `${ART_FOLDER}/`,
      cursor
    });

    for (const obj of listed.objects) {
      files.push(obj.key);
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  return files;
}

/**
 * Stream an object's bytes back to the client with the right Content-Type and
 * permissive CORS. Returns a 404 if the key doesn't exist.
 */
async function serveImage(bucket, key) {
  const object = await bucket.get(key);

  if (object === null) {
    return json({ error: `Object not found: ${key}` }, 404);
  }

  const headers = {
    'Content-Type': mimeFor(key),
    'Content-Length': String(object.size),
    'Cache-Control': 'public, max-age=86400',
    ...CORS_HEADERS
  };

  // Stream the body directly from R2 — no buffering the whole image in memory.
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env, ctx) {
    const bucket = env.ART_BUCKET;

    // Preflight for cross-origin requests from the static site.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // /img/<key> → serve the raw object bytes.
    if (pathname.startsWith('/img/')) {
      const key = pathname.slice('/img/'.length);
      if (!key) return json({ error: 'Missing object key' }, 400);
      return serveImage(bucket, key);
    }

    // Anything else → the folder listing.
    try {
      const files = await listFiles(bucket);
      return json({ files });
    } catch (err) {
      return json({ error: `Failed to list objects: ${err.message}` }, 500);
    }
  }
};
