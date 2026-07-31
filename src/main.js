import './style.css';
import { PICKER_CONFIG } from './config.js';
import { chooseFromPhotos } from './picker.js';

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

/** @type {Array<{id: string, name: string}>} */
let items = [];
/** @type {string|null} */
let currentId = null;

/**
 * Persist the gallery to localStorage so the wall survives reloads.
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

function hasValidKeys() {
  return PICKER_CONFIG.clientId !== 'YOUR_GOOGLE_CLIENT_ID';
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

/**
 * Render each artwork as a framed piece on the wall. Each image is shown at
 * a "thumbnail" resized by the Photos API without needing extra storage.
 */
function renderWall() {
  galleryWall.innerHTML = '';
  emptyState.classList.toggle('hidden', items.length > 0);
  // Only hide the "Add photographs" action link, not the whole footer (which
  // also carries the privacy policy and terms links).
  addMoreLink.style.display = items.length ? 'inline' : 'none';

  items.forEach((item, index) => {
    const figure = document.createElement('figure');
    figure.className = 'artwork';
    figure.style.setProperty('--idx', index);

    const img = document.createElement('img');
    img.className = 'artwork-img';
    img.src = item.url;
    img.alt = item.name || 'Artwork';
    img.loading = 'lazy';
    img.draggable = false;
    img.addEventListener('click', () => openLightbox(index));

    const caption = document.createElement('figcaption');
    caption.className = 'plaque';
    caption.textContent = item.name
      ? item.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
      : 'Untitled';

    const remove = document.createElement('button');
    remove.className = 'artwork-remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${item.name}`);
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
  lightboxImage.alt = item.name || 'Artwork';
  lightboxCaption.textContent = item.name || 'Untitled';
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
 * Launch the Photos Picker flow end-to-end: authenticate, create a session,
 * open the picker, poll for the selection, then merge into the collection.
 */
async function startPicking() {
  if (!hasValidKeys()) {
    showToast('Add your Google API key & client ID in src/config.js first.');
    return;
  }

  const remaining = MAX_ITEMS - items.length;
  if (remaining <= 0) {
    showToast(`The gallery holds up to ${MAX_ITEMS} works.`);
    return;
  }

  pickButton.disabled = true;
  pickButton.textContent = 'Opening Google Photos…';
  try {
    const picked = await chooseFromPhotos(Math.min(remaining, 50));
    if (!picked.length) return;

    // Keep only photos (skip videos) and de-duplicate by id.
    const known = new Set(items.map((i) => i.id));
    const fresh = picked
      .filter((p) => p.type !== 'video' && !known.has(p.id))
      .slice(0, remaining);

    items.push(...fresh);
    save();
    renderWall();
    if (fresh.length) {
      showToast(
        fresh.length === 1
          ? 'Added 1 work to the wall'
          : `Added ${fresh.length} works to the wall`
      );
    }
  } catch (err) {
    console.error(err);
    showToast(`Could not open the picker: ${err.message}`);
  } finally {
    pickButton.disabled = false;
    pickButton.textContent = 'Add Photographs';
  }
}

// --- Event wiring ----------------------------------------------------------
pickButton.addEventListener('click', startPicking);
addMoreLink.addEventListener('click', (e) => {
  e.preventDefault();
  startPicking();
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
renderWall();
