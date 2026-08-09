/**
 * art-gallery-list — a Cloudflare Worker that lists the image objects in an R2
 * bucket's `art` folder and returns them as JSON.
 *
 * Response shape:
 *   { "files": ["sunset.jpg", "blue-period-study.webp", ...] }
 *
 * The frontend fetches this JSON, then renders each file via the bucket's
 * public URL (<bucketUrl>/art/<key>).
 */

const ART_FOLDER = 'art';

/** CORS: allow the static site (any origin) to read the listing. */
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

export default {
  async fetch(request, env, ctx) {
    const bucket = env.ART_BUCKET;

    // Easy preflight for cross-origin fetches from the static site.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    try {
      const files = await listFiles(bucket);
      return json({ files });
    } catch (err) {
      return json({ error: `Failed to list objects: ${err.message}` }, 500);
    }
  }
};
