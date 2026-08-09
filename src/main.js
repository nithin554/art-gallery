import './style.css';
import { isConfigured, loadGallery, thumbnailUrl } from './r2.js';

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

    const remove = document.createElement('button');
    remove.className = 'artwork-remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${prettyName(item.name)}`);
    remove.textContent = '×';
    remove.addEventListener('click', (e) => {
      e.stopPropagation();
      removeItem(index);
    });

    figure.append(img, caption, remove);
    galleryWall.appendChild(figure);
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
    showToast(
      items.length === 1
        ? 'Hung 1 work from the bucket'
        : `Hung ${items.length} works from the bucket`
    );
  } catch (err) {
    console.error(err);
    showToast(`Could not load the gallery: ${err.message}`, 6000);
  } finally {
    pickButton.disabled = false;
    pickButton.textContent = original;
  }
}

// --- Event wiring ----------------------------------------------------------
pickButton.addEventListener('click', refreshGallery);
addMoreLink.addEventListener('click', (e) => {
  e.preventDefault();
  refreshGallery();
});
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
load();
// Only auto-fill the wall on first visit. Subsequent reloads keep the
// arrangement the visitor curated in localStorage.
if (!items.length) {
  refreshGallery();
}
