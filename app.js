// Omarchy-themes demo: cycle through the 29 stock themes with a button,
// keyboard shortcut (T), and a dropdown picker. Persists choice in
// localStorage so the same theme loads next time.

import { THEMES } from './themes.js';

// ---- DOM refs ----
const html         = document.documentElement;
const cycleBtn     = document.getElementById('cycleBtn');
const picker       = document.getElementById('themePicker');
const currentSlug  = document.getElementById('currentSlug');
const demoName     = document.getElementById('demoName');
const demoName2    = document.getElementById('demoName2');
const demoLabel    = document.getElementById('demoLabel');
const swatchList   = document.getElementById('swatchList');
const themeCount   = document.getElementById('themeCount');

themeCount.textContent = String(THEMES.length);

// ---- helpers ----
const bySlug = (slug) => THEMES.find(t => t.slug === slug) || THEMES[0];

function applyTheme(slug, { persist = true } = {}) {
  const theme = bySlug(slug);
  const root  = document.documentElement;

  // drei Hintergrund-Schichten aus dem accent + background ableiten
  const bg  = theme.c.background || theme.c.dark_background || '#0d1117';
  const fg  = theme.c.foreground || '#e6edf3';

  root.setAttribute('data-theme', theme.slug);
  root.style.setProperty('--bg',           bg);
  root.style.setProperty('--fg',           fg);
  root.style.setProperty('--bg-elev',      mix(bg, theme.c.accent, 0.08));
  root.style.setProperty('--bg-elev-2',    mix(bg, theme.c.accent, 0.14));
  root.style.setProperty('--accent',       theme.c.accent || '#58a6ff');
  root.style.setProperty('--accent-fg',    pickFg(theme.c.accent));
  root.style.setProperty('--fg-muted',     mix(fg, bg, 0.4));
  root.style.setProperty('--border',       theme.c.selection || mix(fg, bg, 0.18));
  root.style.setProperty('--ok',           theme.c.green || '#3fb950');

  // UI-Labels aktualisieren
  const label = labelFor(theme.slug);
  currentSlug.textContent = theme.slug;
  demoName.textContent  = theme.slug;
  demoName2.textContent = theme.slug;
  demoLabel.textContent = label;

  // Picker synchronisieren
  picker.value = theme.slug;

  // Swatches rendern
  renderSwatches(theme);

  if (persist) {
    try { localStorage.setItem('omarchy-theme', theme.slug); } catch (e) {}
  }

  // Theme-Color meta synchron mit dem aktuellen Hintergrund halten (mobile Adressleiste).
  // Meta-Tag existiert statisch im <head>; nur content aktualisieren.
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute('content', bg);
}

function labelFor(slug) {
  return slug
    .split('-')
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// Mische zwei Hex-Farben (linear-interpolation) — vermeidet eine extra Dep.
function mix(hexA, hexB, t) {
  if (!hexA || !hexB) return hexA || hexB || '#000000';
  const a = parseHex(hexA), b = parseHex(hexB);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl= Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
function parseHex(h) {
  // Guard against undefined / empty / short hex (#1234, #abc) — without this, mix() and
  // luminance() propagate NaN into CSS rgb() and silently break contrast.
  if (typeof h !== 'string' || !h) return [0, 0, 0];
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  if (s.length !== 6 || /[^0-9a-f]/i.test(s)) return [0, 0, 0];
  return [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)];
}

// Rec. 709 luma (0..1).
function luminance(hex) {
  if (!hex) return 0;
  const [r, g, b] = parseHex(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG contrast ratio between two sRGB hex colors: (L1 + 0.05) / (L2 + 0.05),
// with L1 = lighter, L2 = darker (>= 1 by construction).
function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// Pick the foreground candidate with the highest contrast against `bg`.
// Used for the primary CTA accent-fg so every theme — light or dark — meets
// at least WCAG AA-large (3:1) instead of relying on a fixed luma cutoff.
// Falls back to '#0d1117' on garbage input (NaN/invalid hex) so the button
// stays readable rather than becoming a brick of invisible text.
function pickFg(bg) {
  const CANDIDATES = ['#0d1117', '#ffffff'];
  let best = '#0d1117', bestR = -1;
  for (const c of CANDIDATES) {
    const r = contrastRatio(bg, c);
    if (Number.isFinite(r) && r > bestR) { bestR = r; best = c; }
  }
  return best;
}

const SWATCH_FIELDS = [
  ['bg',      'background'],
  ['fg',      'foreground'],
  ['accent',  'accent'],
  ['red',     'red'],
  ['yellow',  'yellow'],
  ['green',   'green'],
  ['cyan',    'cyan'],
  ['blue',    'blue'],
  ['magenta', 'magenta'],
];

function renderSwatches(theme) {
  swatchList.replaceChildren();
  const labels = { bg:'Background', fg:'Foreground', accent:'Accent', red:'Red', yellow:'Yellow', green:'Green', cyan:'Cyan', blue:'Blue', magenta:'Magenta' };
  for (const [name, field] of SWATCH_FIELDS) {
    const v = theme.c[field] || theme.c.bright_blue || theme.c.bright_yellow || '#888';
    const li = document.createElement('li');
    li.className = 'swatch';
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.background = v;
    const label = document.createElement('span');
    label.textContent = labels[name] || name;
    li.appendChild(chip);
    li.appendChild(label);
    swatchList.appendChild(li);
  }
}

// ---- picker options ----
for (const t of THEMES) {
  const opt = document.createElement('option');
  opt.value = t.slug;
  opt.textContent = labelFor(t.slug) + (t.mode === 'light' ? ' · light' : ' · dark');
  picker.appendChild(opt);
}

// ---- nav: cycle ----
function cycle() {
  const i = THEMES.findIndex(t => t.slug === (picker.value || THEMES[0].slug));
  const next = THEMES[(i + 1) % THEMES.length];
  applyTheme(next.slug);
}
cycleBtn.addEventListener('click', cycle);
picker.addEventListener('change', () => applyTheme(picker.value));

// T-Taste → naechstes Theme (ausser wenn Modifier gedrueckt ist oder man in einem Input ist)
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  if (e.key !== 't' && e.key !== 'T') return;
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  e.preventDefault();
  cycle();
});

// ---- init ----
const initial = (() => {
  try {
    return localStorage.getItem('omarchy-theme') || THEMES[10].slug; // THEMES[10] = hermarchy (default fallback when localStorage empty)
  } catch (e) { return THEMES[0].slug; }
})();
applyTheme(initial, { persist: false });
