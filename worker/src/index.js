/**
 * art-gallery-worker — serves the gallery's R2 contents with CORS headers so
 * the static site can load them cross-origin (prevents ERR_BLOCKED_BY_ORB).
 *
 * Routes:
 *   GET /                  → JSON listing of objects in the `art` folder
 *                            { "files": ["sunset.jpg", ...] }
 *                            (directory markers like `art/` are filtered out)
 *   GET /img/<key>         → streams the image bytes with a correct
 *                            Content-Type and Access-Control-Allow-Origin
 *   GET /img/<key>?w=<px>  → resizes the image at the edge to the given width
 *                            (CF image resizing → webp), for fast wall tiles
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
 * List every real object under the `art` folder.
 *
 * R2's bucket binding exposes `list({ prefix, delimiter })`. It is paginated,
 * so we keep calling until a returned list is truncated, then concatenate.
 *
 * `delimiter` is deliberately omitted so we get all keys. Keys ending in a `/`
 * are directory markers (pseudo-folders, e.g. `art/`), not real files, so we
 * skip them — otherwise they'd produce a broken image tile.
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
      if (obj.key.endsWith('/')) continue; // skip directory markers
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
    'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    ...CORS_HEADERS
  };

  // Stream the body directly from R2 — no buffering the whole image in memory.
  return new Response(object.body, { headers });
}

const IMG_RESIZE_PASS_HEADER = 'x-img-resize';

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

    // /img/<key> → serve the object bytes (optionally resized).
    if (pathname.startsWith('/img/')) {
      const key = pathname.slice('/img/'.length);
      if (!key) return json({ error: 'Missing object key' }, 400);

      const width = parseInt(url.searchParams.get('w') || '', 10);

      // Already a resize pass → serve the raw bytes (the size is baked in).
      if (request.headers.get(IMG_RESIZE_PASS_HEADER) === '1') {
        return serveImage(bucket, key);
      }

      // Request a resized variant at the edge if a width was provided.
      if (Number.isFinite(width) && width > 0) {
        const resizeUrl = new URL(url);
        resizeUrl.searchParams.delete('w');
        const resizeRequest = new Request(resizeUrl, {
          headers: {
            ...request.headers,
            [IMG_RESIZE_PASS_HEADER]: '1'
          }
        });
        const transformed = await fetch(resizeRequest, {
          cf: {
            image: {
              width,
              fit: 'scale-down',
              format: 'webp',
              sharpness: 0
            }
          }
        });
        // Merge our CORS/cache headers onto the transformed response.
        const responseHeaders = new Headers(transformed.headers);
        Object.entries(CORS_HEADERS).forEach(([k, v]) =>
          responseHeaders.set(k, v)
        );
        responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(transformed.body, {
          status: transformed.status,
          headers: responseHeaders
        });
      }

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
