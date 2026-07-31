/**
 * Generates PNG assets from the SVG logo using ImageMagick.
 *
 * Outputs:
 *   public/google-logo.png  — 120×120 square PNG for Google's OAuth consent
 *                              screen "App logo" field.
 *   public/favicon.png      — classic 32×32 favicon fallback.
 *
 * Requires the ImageMagick `magick` (or `convert`) binary.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const jobs = [
  { src: 'public/logo.svg', dest: 'public/google-logo.png', size: 120 },
  { src: 'public/logo.svg', dest: 'public/favicon.png', size: 32 }
];

async function pickMagick() {
  for (const cmd of ['magick', 'convert']) {
    try {
      await execFileP(cmd, ['--version']);
      return cmd;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function main() {
  const magick = await pickMagick();
  if (!magick) {
    // Non-fatal: the site works fine with SVG-only logo assets.
    console.warn('[logo-generator] ImageMagick not found — skipping PNG output.');
    return;
  }

  for (const job of jobs) {
    const src = path.join(root, job.src);
    const dest = path.join(root, job.dest);
    if (!existsSync(src)) {
      console.warn(`[logo-generator] missing source: ${job.src}`);
      continue;
    }
    // Render the SVG at the target size to a PNG.
    await execFileP(magick, [
      src,
      '-background',
      'none',
      '-density',
      '192',
      '-thumbnail',
      `${job.size}x${job.size}>`,
      dest
    ]);
    console.log(`[logo-generator] wrote ${dest} (${job.size}px)`);
  }
}

main().catch((err) => {
  console.error('[logo-generator] failed:', err.message);
  process.exitCode = 1;
});
