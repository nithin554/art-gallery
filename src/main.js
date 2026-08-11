import './style.css';
import {
  isConfigured,
  loadGallery,
  thumbnailUrl,
  describeUrl
} from './r2.js';

const STORAGE_KEY = 'art-gallery-items';
const MAX_ITEMS = 24;

const galleryWall = document.getElementById('galleryWall');
const emptyState = document.getElementById('emptyState');
const pickButton = document.getElementById('pickButton');
const addMoreLink = document.getElementById('addMoreLink');
const toast = document.getElementById('toast');

const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxCaption = document.getElementById('lightboxCaption');
const closeLightbox = document.getElementById('closeLightbox');
const prevImage = document.getElementById('prevImage');
const nextImage = document.getElementById('nextImage');

/** @type {Array<{id: string, name: string, url: string}>} */
let items = [];
/** @type {string|null} */
let currentId = null;

/** In-memory cache of AI overviews, keyed by artwork id (`{name, description}`). */
const descriptions = new Map();

/**
 * Fetch (and cache) the AI overview for an artwork. Never rejects — on any
 * failure it resolves to null so the UI can fall back to the file name.
 * @param {string} key
 * @returns {Promise<{name: string, description: string}|null>}
 */
async function ensureDescription(key) {
  if (descriptions.has(key)) return descriptions.get(key);
  try {
    const resp = await fetch(describeUrl(key), { cache: 'no-cache' });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data || typeof data.name !== 'string') return null;
    descriptions.set(key, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Persist the gallery to localStorage so the wall survives reloads (the order
 * people have hung the works).
 */
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage may be unavailable (private mode); gallery works in-session.
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    items = raw ? JSON.parse(raw) : [];
  } catch {
    items = [];
  }
}

function showToast(message, durationMs = 2600) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('visible'), durationMs);
}

function prettyName(name) {
  return (name || 'Untitled')
    .split('/')
    .pop()
    .replace(/\.[^/.]+$/, '')
    .replace(/_/g, ' ');
}

const PLAQUE_MIN_FONT_PX = 6; // even very long titles shrink to fit, never "..."

/**
 * Shrink the plaque's font size so its title ALWAYS fits on one line within
 * the fixed plaque width — no wrapping, no "..." truncation. A binary search
 * is used to pick the largest font size that still fits, capped at the
 * stylesheet's base size so the theme's sizing still applies at the top end.
 * @param {HTMLElement} el
 */
function fitPlaque(el) {
  el.style.whiteSpace = 'nowrap';
  el.style.overflow = 'hidden';
  el.style.textOverflow = 'clip'; // never let the browser add an ellipsis

  // Recompute from the stylesheet every time (in case a previous shrink left an
  // inline size behind).
  const basePx = parseFloat(getComputedStyle(el).fontSize) || 14;
  const avail = el.clientWidth;

  // Short-circuit if it already fits, clearing any leftover inline size.
  el.style.fontSize = `${basePx}px`;
  if (el.scrollWidth <= avail + 1) return;

  // Binary search for the largest font (down to PLAQUE_MIN_FONT_PX) that fits.
  let lo = PLAQUE_MIN_FONT_PX;
  let hi = basePx;
  while (hi - lo > 0.1) {
    const mid = (lo + hi) / 2;
    el.style.fontSize = `${mid}px`;
    if (el.scrollWidth <= avail + 1) {
      lo = mid; // fits — try a bit bigger
    } else {
      hi = mid - 0.1; // too big — shrink
    }
  }
  el.style.fontSize = `${lo}px`;
}

/**
 * Render each artwork as a framed piece on the wall.
 */
function renderWall() {
  galleryWall.innerHTML = '';
  emptyState.classList.toggle('hidden', items.length > 0);
  // Only hide the "Refresh from the bucket" action link, not the footer
  // (which also carries the privacy policy and terms links).
  addMoreLink.style.display = items.length ? 'inline' : 'none';

  items.forEach((item, index) => {
    const figure = document.createElement('figure');
    figure.className = 'artwork';
    figure.style.setProperty('--idx', index);

    const img = document.createElement('img');
    img.className = 'artwork-img';
    img.src = thumbnailUrl(item.name);
    img.alt = prettyName(item.name);
    img.loading = 'lazy';
    img.draggable = false;
    img.addEventListener('click', () => openLightbox(index));

    const caption = document.createElement('figcaption');
    caption.className = 'plaque';
    caption.textContent = prettyName(item.name);

    // Mandala petals at the frame corners.
    const corners = ['tl', 'tr', 'bl', 'br'].map((pos) => {
      const c = document.createElement('span');
      c.className = `frame-corner ${pos}`;
      c.setAttribute('aria-hidden', 'true');
      return c;
    });

    // Enrich the nameplate with the AI-curated title once ready, then shrink
    // the font so it still fits on one line.
    ensureDescription(item.name).then((overview) => {
      if (overview && overview.name && caption.isConnected) {
        caption.textContent = overview.name;
        caption.title = overview.description || '';
        fitPlaque(caption);
      }
    });

    const remove = document.createElement('button');
    remove.className = 'artwork-remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${prettyName(item.name)}`);
    remove.textContent = '×';
    remove.addEventListener('click', (e) => {
      e.stopPropagation();
      removeItem(index);
    });

    figure.append(img, caption, ...corners, remove);
    galleryWall.appendChild(figure);
    // Fit the (file-name) label once the plaque has its width in the layout.
    fitPlaque(caption);
  });
}

function removeItem(index) {
  items.splice(index, 1);
  save();
  renderWall();
  showToast('Removed from the gallery');
}

function openLightbox(index) {
  const item = items[index];
  currentId = item.id;
  lightboxImage.src = item.url;
  lightboxImage.alt = prettyName(item.name);
  lightboxCaption.textContent = prettyName(item.name);
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  updateNav();

  // Show the AI overview for this artwork as soon as it's available.
  ensureDescription(item.name).then((overview) => {
    if (currentId !== item.id) return; // user moved on to another photo
    if (overview) {
      lightboxCaption.innerHTML = '';
      const nameEl = document.createElement('span');
      nameEl.className = 'modal-caption-title';
      nameEl.textContent = overview.name || prettyName(item.name);
      lightboxCaption.appendChild(nameEl);
      if (overview.description) {
        const descEl = document.createElement('span');
        descEl.className = 'modal-caption-desc';
        descEl.textContent = overview.description;
        lightboxCaption.appendChild(descEl);
      }
    }
  });
}

function closeLightboxModal() {
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  currentId = null;
  // Let the browser unload the image.
  setTimeout(() => (lightboxImage.src = ''), 250);
}

function step(direction) {
  const idx = items.findIndex((i) => i.id === currentId);
  const next = (idx + direction + items.length) % items.length;
  openLightbox(next);
}

function updateNav() {
  const single = items.length <= 1;
  prevImage.style.display = single ? 'none' : 'block';
  nextImage.style.display = single ? 'none' : 'block';
}

/**
 * Pull the artwork list from the R2 bucket's `art` folder and hang them.
 */
async function refreshGallery() {
  if (!isConfigured()) {
    showToast('Set R2_CONFIG.listUrl in src/config.js first.');
    return;
  }

  pickButton.disabled = true;
  const original = pickButton.textContent;
  pickButton.textContent = 'Hanging artworks…';
  try {
    const gallery = await loadGallery();
    if (!gallery.length) {
      showToast('No artworks found in the bucket art folder.');
      return;
    }
    items = gallery.slice(0, MAX_ITEMS);
    save();
    renderWall();
    celebrate();
    showToast(
      items.length === 1
        ? 'Hung 1 work from the bucket ✿'
        : `Hung ${items.length} works from the bucket ✿`
    );
  } catch (err) {
    console.error(err);
    showToast(`Could not load the gallery: ${err.message}`, 6000);
  } finally {
    pickButton.disabled = false;
    pickButton.textContent = original;
  }
}

// --- Theme switching --------------------------------------------------------
const THEME_KEY = 'art-gallery-theme';
const themeToggle = document.getElementById('themeToggle');
const themeToggleIcon = document.getElementById('themeToggleIcon');
const themeToggleLabel = themeToggle.querySelector('.theme-toggle-label');

const THEME_ICONS = { dark: '🌙', light: '☀️' };
const THEME_LABELS = { dark: 'Dark', light: 'Light' };

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggleIcon.textContent = THEME_ICONS[theme];
  themeToggleLabel.textContent = THEME_LABELS[theme];
  // Keep the browser chrome's theme-color in sync with the palette.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f7f1e6' : '#1f1a20');
}

/**
 * Initial theme: an explicit stored choice wins; otherwise respect the OS
 * preference; otherwise fall back to dark (the original museum look).
 */
function initTheme() {
  let theme = 'dark';
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') {
      theme = stored;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      theme = 'light';
    }
  } catch {
    /* storage unavailable — keep the default */
  }
  applyTheme(theme);
}

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
}

// --- Floating mandala petals ----------------------------------------------
const PETAL_GLYPHS = ['❀', '❁', '✿', '🌸', '✺'];
const palette = () => {
  // Keep the accent family, varied between gold and a few soft hues.
  const theme = document.documentElement.getAttribute('data-theme');
  return theme === 'light'
    ? ['#f0b94e', '#ff8a6b', '#c9a0f0', '#7fe0c8', '#ff9bc0', '#f6c96b']
    : ['#f6c96b', '#ffe7b3', '#ff8a6b', '#c9a0f0', '#7fe0c8', '#ff9bc0'];
};

/**
 * Spawn a burst of petals at a given screen position (celebratory). If no
 * element is supplied, petals fall from the top across the whole viewport.
 */
function rainPetals(opts = {}) {
  const layer = document.getElementById('fallingPetals');
  if (!layer) return;

  const burst = opts.burst || false;
  const colors = palette();
  const count = opts.count || (burst ? 18 : 1);
  const duration = opts.duration || (burst ? 2600 : 8000);
  const origin = opts.origin || null; // {x, y} client coords

  for (let i = 0; i < count; i++) {
    const petal = document.createElement('span');
    petal.className = 'petal';
    petal.textContent = PETAL_GLYPHS[Math.floor(Math.random() * PETAL_GLYPHS.length)];
    petal.style.color = colors[Math.floor(Math.random() * colors.length)];
    petal.style.fontSize = `${0.7 + Math.random() * 1.1}rem`;

    // Start position.
    if (origin) {
      const spread = 120;
      petal.style.left = `${origin.x + (Math.random() - 0.5) * spread}px`;
      petal.style.top = `${origin.y + (Math.random() - 0.5) * spread}px`;
    } else {
      petal.style.left = `${Math.random() * 100}vw`;
    }

    petal.style.animationDuration = `${duration + Math.random() * 900}ms`;
    petal.style.animationDelay = `${burst ? Math.random() * 300 : 0}ms`;
    if (burst) petal.style.animationPlayState = 'running';

    layer.appendChild(petal);
    petal.addEventListener('animationend', () => petal.remove());
  }
}

/** Keep a gentle, constant sprinkle of petals across the page. */
function startPetalDrift() {
  const interval = setInterval(() => rainPetals({ count: 3 }), 1800);
  // Never block the tab from unloading.
  window.addEventListener('beforeunload', () => clearInterval(interval));
}

/** Confetti-like celebration when the wall gets (re)hung. */
function celebrate() {
  const burstOrigin = { x: window.innerWidth / 2, y: window.innerHeight / 4 };
  rainPetals({ burst: true, count: 22, origin: burstOrigin });
}

// --- Event wiring ----------------------------------------------------------
const brandHome = document.getElementById('brandHome');
if (brandHome) {
  brandHome.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
pickButton.addEventListener('click', refreshGallery);
addMoreLink.addEventListener('click', (e) => {
  e.preventDefault();
  refreshGallery();
});
themeToggle.addEventListener('click', toggleTheme);
closeLightbox.addEventListener('click', closeLightboxModal);
prevImage.addEventListener('click', () => step(-1));
nextImage.addEventListener('click', () => step(1));

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightboxModal();
});

document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightboxModal();
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});

// --- Boot ------------------------------------------------------------------
initTheme();
startPetalDrift();
// Respect OS theme changes while the page is open (when no explicit choice).
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(e.matches ? 'light' : 'dark');
    }
  });
}
load();
// Only auto-fill the wall on first visit. Subsequent reloads keep the
// arrangement the visitor curated in localStorage.
if (!items.length) {
  refreshGallery();
}
