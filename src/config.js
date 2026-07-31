/**
 * Google Photos Picker API configuration.
 *
 * This gallery uses the modern **Google Photos Picker API**
 * (https://photospicker.googleapis.com/v1/...) which lets a client-side,
 * backend-free web app request access to a *selected subset* of a user's
 * Google Photos library.
 *
 * To set it up you must:
 *
 * 1. Create a Google Cloud Project at https://console.cloud.google.com
 * 2. Enable the **Photos Picker API** in
 *    (APIs & Services → Library → "Photos Picker API").
 * 3. Create an "API key" (APIs & Services → Credentials → Create credentials
 *    → API key) and restrict it to the Photos Picker API and to your HTTP
 *    referrer(s).
 * 4. Create an "OAuth 2.0 Client ID" for a **Web application**:
 *    - In "Authorized JavaScript origins" add your site origin, e.g.
 *      https://yourdomain.com  (for local Vite dev add http://localhost:5173).
 *    - Note the resulting Client ID.
 * 5. These scopes must be approved on your OAuth consent screen:
 *    - https://www.googleapis.com/auth/photospicker.mediaitems.readonly
 *
 * Then fill in the values below.
 *
 * ⚠️ Because this is a purely static site with no backend, the OAuth client ID
 * and API key ship to the browser. Always restrict your API key to the Photos
 * Picker API and to your own domain.
 */
export const PICKER_CONFIG = {
  /** Your Google Cloud API key (restricted to the Photos Picker API) */
  apiKey: 'YOUR_GOOGLE_API_KEY',

  /** Your OAuth 2.0 Web Application Client ID */
  clientId: 'YOUR_GOOGLE_CLIENT_ID',

  /** The Photos Picker API endpoint base URL. */
  baseUrl: 'https://photospicker.googleapis.com/v1',

  /** OAuth scopes required by the Photos Picker API. */
  scopes: ['https://www.googleapis.com/auth/photospicker.mediaitems.readonly']
};
