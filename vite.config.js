import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * GitHub Pages base path.
 *
 * - When set explicitly (e.g. VITE_BASE=/art-gallery/) that is used.
 * - If the REPO_NAME env var is set, we deploy under that repo subpath
 *   (e.g. https://<user>.github.io/REPO_NAME/ → base "/REPO_NAME/").
 * - Otherwise we assume a user/organization pages site at "/".
 */
function resolveBase() {
  if (process.env.VITE_BASE) {
    return process.env.VITE_BASE.startsWith('/')
      ? process.env.VITE_BASE
      : `/${process.env.VITE_BASE}`;
  }
  if (process.env.REPO_NAME) {
    return `/${process.env.REPO_NAME}/`;
  }
  return '/';
}

export default defineConfig({
  base: resolveBase(),
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        privacy: resolve(root, 'privacy.html'),
        terms: resolve(root, 'terms.html')
      }
    }
  }
});
