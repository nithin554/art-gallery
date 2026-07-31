import { PICKER_CONFIG } from './config.js';

/**
 * Google Photos Picker API client.
 *
 * Docs: https://developers.google.com/photos/picker
 *
 * Flow (all client-side, no backend required):
 *   1. create   → POST /v1/sessions            returns a PickingSession
 *   2. open     → send the user to pickerUri   (they pick in Google Photos)
 *   3. poll     → GET  /v1/sessions/{id}       until mediaItemsSet === true
 *   4. list     → GET  /v1/mediaItems?sessionId → the PickedMediaItems
 *   5. finally  → DELETE /v1/sessions/{id}     housekeeping
 */

// OAuth 2.0 token client (Google Identity Services) singleton.
let tokenClient = null;
let accessToken = null;

const GSI_SRC = 'https://accounts.google.com/gsi/client';

/**
 * Inject a <script> into the page and resolve when it has loaded.
 * @param {string} src
 * @returns {Promise<void>}
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

function jsonHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function handleErrors(response) {
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      const err = body.error?.message;
      if (err) message = err;
    } catch {
      /* no JSON body */
    }
    throw new Error(message);
  }
  return response.json();
}

/**
 * Lazily initialise (and refresh) an access token for the user.
 * @returns {Promise<string>} a valid bearer token
 */
export async function authenticate() {
  if (accessToken) return accessToken;

  if (!window.google?.accounts?.oauth2) {
    await loadScript(GSI_SRC);
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: PICKER_CONFIG.clientId,
    scope: PICKER_CONFIG.scopes.join(' '),
    callback: (resp) => {
      // The callback stores the token; the promise settles via a hook.
      if (!resp.error && resp.access_token) {
        accessToken = resp.access_token;
      }
    }
  });

  const granted = await new Promise((resolve) => {
    tokenClient.requestAccessToken({ prompt: 'consent' });
    // requestAccessToken is a fire-and-forget UI flow; poll briefly for the
    // callback to set accessToken.
    const start = Date.now();
    const timer = setInterval(() => {
      if (accessToken) {
        clearInterval(timer);
        resolve(accessToken);
      } else if (Date.now() - start > 20000) {
        clearInterval(timer);
        resolve(null);
      }
    }, 150);
  });

  if (!granted) {
    throw new Error('Authorization was not granted or it timed out.');
  }
  return granted;
}

/**
 * Send a bearer-authenticated request to the Photos Picker API.
 * @param {string} method HTTP verb
 * @param {string} path endpoint path (relative to baseUrl)
 * @param {object} [body] optional JSON body
 * @returns {Promise<any>} parsed JSON response
 */
async function apiRequest(method, path, body) {
  const token = await authenticate();
  const url = `${PICKER_CONFIG.baseUrl}${path}`;
  const response = await fetch(url, {
    method,
    headers: jsonHeaders(token),
    body: body ? JSON.stringify(body) : undefined
  });
  return handleErrors(response);
}

/**
 * Open the full Photos Picker flow. Resolves with the picked media items
 * (each with { id, name, url }) or an empty array if the user picked nothing.
 *
 * @param {number} [maxItemCount] max selectable items
 * @returns {Promise<Array<{id: string, name: string, url: string}>>}
 */
export async function chooseFromPhotos(maxItemCount = 50) {
  // 1. Create a picking session.
  const session = await apiRequest('POST', '/sessions', {
    pickingConfig: { maxItemCount: String(maxItemCount) }
  });

  const sessionId = session.id;
  if (!sessionId || !session.pickerUri) {
    throw new Error('Could not start a Photos Picker session.');
  }

  try {
    // 2. Send the user to Google Photos to pick. Add /autoclose so the tab
    //    closes itself when they finish, then poll until items are set.
    const pickerUri = appendAutoclose(session.pickerUri);
    const opened = window.open(pickerUri, '_blank');

    if (!opened) {
      // Popup was blocked — still let the user proceed manually.
      window.location.assign(pickerUri);
    }

    const itemsReady = await waitForMediaItems(session);
    if (!itemsReady) {
      return []; // user never completed a pick (timeout) → treat as empty
    }

    // 3. Retrieve the selected media items.
    const data = await apiRequest(
      'GET',
      `/mediaItems?sessionId=${encodeURIComponent(sessionId)}&pageSize=100`
    );

    return (data.mediaItems || []).map((item) => ({
      id: item.id,
      name: item.mediaFile?.filename || 'Untitled',
      type: item.type?.toLowerCase() || 'photo',
      url: buildBaseUrl(item.mediaFile?.baseUrl)
    }));
  } finally {
    // Housekeeping: delete the session so we stay within resource limits.
    try {
      await apiRequest('DELETE', `/sessions/${encodeURIComponent(sessionId)}`);
    } catch {
      /* best-effort clean-up */
    }
  }
}

/**
 * Append /autoclose to the picker URI when not already present. For web flows
 * this makes the Google Photos tab close itself after the user finishes,
 * giving a smoother experience.
 * @param {string} uri
 * @returns {string}
 */
function appendAutoclose(uri) {
  if (uri.includes('/autoclose')) return uri;
  return `${uri.replace(/\/?$/, '/')}autoclose`;
}

/**
 * Poll the session until the media items are set, honouring the API's
 * recommended poll settings. Returns false if the session expires first.
 * @param {object} session PickingSession from create
 * @returns {Promise<boolean>} true when mediaItemsSet === true
 */
async function waitForMediaItems(session) {
  const intervalMs = parseDuration(session.pollingConfig?.pollInterval) || 3000;
  const timeoutMs =
    parseDuration(session.pollingConfig?.timeoutIn) || 120000;

  let remaining = Math.min(timeoutMs, 900000); // cap at ~15 min
  // Only poll until the session would expire naturally.
  const expireAt = new Date(session.expireTime).getTime();
  const deadline = Number.isFinite(expireAt)
    ? Math.min(Date.now() + remaining, expireAt)
    : Date.now() + remaining;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    let current;
    try {
      current = await apiRequest(
        'GET',
        `/sessions/${encodeURIComponent(session.id)}`
      );
    } catch {
      // Session may have been deleted/expired — stop polling.
      return false;
    }
    if (current.mediaItemsSet) return true;
    remaining = deadline - Date.now();
  }
  return false;
}

/**
 * Parse a protobuf Duration string like "3.5s" into milliseconds.
 * @param {string} [duration]
 * @returns {number}
 */
function parseDuration(duration) {
  if (!duration) return 0;
  const match = /^([\d.]+)s$/.exec(duration.trim());
  if (!match) return 0;
  return Math.round(parseFloat(match[1]) * 1000);
}

/**
 * Append a size hint to a media file base URL so the browser downloads a
 * reasonable resolution instead of the full original.
 * @param {string} [baseUrl]
 * @returns {string}
 */
function buildBaseUrl(baseUrl) {
  if (!baseUrl) return '';
  if (/[=](w|h|d)\d/.test(baseUrl)) return baseUrl; // already has a size hint
  return `${baseUrl}=w2048`;
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
