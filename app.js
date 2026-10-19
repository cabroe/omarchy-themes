// omarchy-themes — Plugin-Story-Homepage
// Zyklisches Wechseln zwischen den 29 Omarchy-Paletten via Cycle-Button,
// T-Tastenkuerzel, Hero-Picker-Toggle und Live-Demo-Picker/Bento.
// Persistiert die Wahl in localStorage; th emed CSS-Variablen werden
// direkt am :root gesetzt, damit die ganze Site synchron umfaerbt.

import { THEMES } from './themes.js';

// ---- DOM refs ----
const html         = document.documentElement;
const cycleBtn     = document.getElementById('cycleBtn');
const picker       = document.getElementById('themePicker');
const pickerGrid   = document.getElementById('pickerGrid');     // Hero (collapsed)
const pickerToggle = document.getElementById('pickerToggle');
const pickerDemo   = document.getElementById('pickerGridDemo'); // Demo-Band (expanded, 29 Tiles)
const currentSlug  = document.getElementById('currentSlug');
const themesBento  = document.getElementById('themesBento');

if (currentSlug) {} // eslint-disable-line no-unused-expressions — defensive

// ---- helpers ----
const bySlug = (slug) => THEMES.find(t => t.slug === slug) || THEMES[0];

function labelFor(slug) {
  return slug
    .split('-')
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function applyTheme(slug, { persist = true } = {}) {
  const theme = bySlug(slug);
  const root  = document.documentElement;

  // drei Hintergrund-Schichten aus accent + background ableiten
  const bg = theme.c.background || theme.c.dark_background || '#0d1117';
  const fg = theme.c.foreground || '#e6edf3';

  root.setAttribute('data-theme', theme.slug);
  root.style.setProperty('--bg',        bg);
  root.style.setProperty('--fg',        fg);
  root.style.setProperty('--bg-elev',   mix(bg, theme.c.accent, 0.08));
  root.style.setProperty('--bg-elev-2', mix(bg, theme.c.accent, 0.14));
  root.style.setProperty('--accent',    theme.c.accent || '#58a6ff');
  root.style.setProperty('--accent-fg', pickFg(theme.c.accent));
  root.style.setProperty('--fg-muted',  mix(fg, bg, 0.4));
  root.style.setProperty('--border',    theme.c.selection || mix(fg, bg, 0.18));
  root.style.setProperty('--ok',        theme.c.green || '#3fb950');

  // Luma-Boost: bei grauen Akzenten (white, solitude, lumon, vantablack) sind die
  // radial-tint-Layer im Hero sonst unsichtbar. wir heben sie proportional an.
  const accentLuma = luminance(theme.c.accent);
  const boost = accentLuma < 0.35;
  const strongPct = boost ? 24 : 16;
  const midPct    = boost ? 16 : 10;
  const softPct   = boost ? 10 :  6;
  root.style.setProperty('--accent-tint-strong', `color-mix(in srgb, var(--accent) ${strongPct}%, transparent)`);
  root.style.setProperty('--accent-tint-mid',    `color-mix(in srgb, var(--accent) ${midPct}%, transparent)`);
  root.style.setProperty('--accent-tint-soft',   `color-mix(in srgb, var(--accent) ${softPct}%, transparent)`);

  // UI-Labels aktualisieren
  if (currentSlug) currentSlug.textContent = theme.slug;

  // <select>-Picker synchronisieren
  if (picker) picker.value = theme.slug;

  // Polygon-Tile aria-pressed synchronisieren (Hero + Demo)
  const syncTile = (grid) => {
    if (!grid) return;
    for (const tile of grid.querySelectorAll('.picker-tile')) {
      tile.setAttribute('aria-pressed', String(tile.dataset.slug === theme.slug));
    }
  };
  syncTile(pickerGrid);
  syncTile(pickerDemo);

  // Bento-Tile aria-pressed synchronisieren
  if (themesBento) {
    for (const tile of themesBento.querySelectorAll('[data-slug]')) {
      const isActive = tile.dataset.slug === theme.slug;
      if (tile.classList.contains('theme-tile')) {
        tile.setAttribute('aria-pressed', String(isActive));
      }
    }
  }

  if (persist) {
    try { localStorage.setItem('omarchy-theme', theme.slug); } catch (e) {}
  }

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute('content', bg);
}

// Mische zwei Hex-Farben (linear-interpolation).
function mix(hexA, hexB, t) {
  if (!hexA || !hexB) return hexA || hexB || '#000000';
  const a = parseHex(hexA), b = parseHex(hexB);
  const r  = Math.round(a[0] + (b[0] - a[0]) * t);
  const g  = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
function parseHex(h) {
  // Guard gegen undefined / empty / short-hex ohne den NaN in CSS durchzulassen.
  if (typeof h !== 'string' || !h) return [0, 0, 0];
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  if (s.length !== 6 || /[^0-9a-f]/i.test(s)) return [0, 0, 0];
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

// Rec. 709 luma (0..1). Linearisierung per sRGB-Gamma.
function luminance(hex) {
  if (!hex) return 0;
  const [r, g, b] = parseHex(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG-Kontrast zweier sRGB-Hex-Werte.
function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// Beste Vordergrund-Variante aus #0d1117 / #fff per Kontrastvergleich — fuer CTA accent-fg.
function pickFg(bg) {
  const CANDIDATES = ['#0d1117', '#ffffff'];
  let best = '#0d1117', bestR = -1;
  for (const c of CANDIDATES) {
    const r = contrastRatio(bg, c);
    if (Number.isFinite(r) && r > bestR) { bestR = r; best = c; }
  }
  return best;
}

// ---- <select>-Options fuellen (a11y + no-JS-Fallback) ----
if (picker) {
  for (const t of THEMES) {
    const opt = document.createElement('option');
    opt.value = t.slug;
    opt.textContent = labelFor(t.slug) + (t.mode === 'light' ? ' · light' : ' · dark');
    picker.appendChild(opt);
  }
}

// ---- Polygon-Tile-Picker (Hero: collapsed, Demo: expanded) ----
function fillPickerGrid(grid) {
  if (!grid) return;
  for (const t of THEMES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-tile';
    btn.dataset.slug = t.slug;
    btn.title = labelFor(t.slug) + (t.mode === 'light' ? ' · light' : ' · dark');
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = t.slug;
    const accentColor = t.c.accent || '#58a6ff';
    btn.style.background = accentColor;
    btn.style.setProperty('--tile-fg', pickFg(accentColor));
    btn.addEventListener('click', () => applyTheme(t.slug));
    grid.appendChild(btn);
  }
}
fillPickerGrid(pickerGrid);
fillPickerGrid(pickerDemo);

// Demo-Picker schliesst sich nicht selbst nach Klick (Expanded-UI),
// Hero-Picker dagegen schon — toggle-button unten.
let pickerExpanded = false;
if (pickerToggle) {
  pickerToggle.addEventListener('click', () => setPickerExpanded(!pickerExpanded));
}
function setPickerExpanded(v) {
  pickerExpanded = v;
  if (!pickerToggle) return;
  pickerToggle.setAttribute('aria-expanded', String(v));
  pickerToggle.textContent = v ? 'Pick theme ▴' : 'Pick theme ▾';
  if (pickerGrid) pickerGrid.hidden = !v;
}

// ---- bento-themes (12 defaults, je 1 Highlight + 3 Satelliten) ----
const BENTO_THEMES = [
  'catppuccin','catppuccin-latte','gruvbox','kanagawa','nord',
  'osaka-jade','rose-pine','solitude','tokyo-night','hackerman',
  'flexoki-light','lumon'
];

function makeSatellite(theme, field, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-tile tile-satellite';
  btn.dataset.slug = theme.slug;
  btn.setAttribute('aria-pressed', 'false');
  const v = theme.c[field] || theme.c.bright_blue || theme.c.bright_yellow || '#888';
  btn.innerHTML = `
    <span class="tile-meta">${label}</span>
    <span class="tile-swatches" aria-hidden="true">
      <span style="background:${v}"></span>
      <span style="background:${v}"></span>
      <span style="background:${v}"></span>
    </span>`;
  btn.addEventListener('click', () => applyTheme(theme.slug));
  return btn;
}

function renderBento() {
  if (!themesBento) return;
  themesBento.replaceChildren();
  for (const slug of BENTO_THEMES) {
    const theme = bySlug(slug);

    // Highlight-Tile
    const highlight = document.createElement('button');
    highlight.type = 'button';
    highlight.className = 'theme-tile tile-highlight';
    highlight.dataset.slug = slug;
    highlight.setAttribute('aria-pressed', 'false');
    highlight.setAttribute('aria-label', `Theme ${labelFor(slug)} aktivieren`);
    const mode = theme.mode === 'light' ? 'light' : 'dark';
    highlight.innerHTML = `
      <span class="tile-meta">${mode}</span>
      <span class="tile-name">${labelFor(slug)}</span>
      <span class="tile-cmd">omarchy theme set ${slug}</span>`;
    highlight.addEventListener('click', () => applyTheme(slug));
    themesBento.appendChild(highlight);

    // 3 Satelliten (accent / background / foreground) als Swatch-Cluster
    themesBento.append(
      makeSatellite(theme, 'accent',     labelFor(slug) + ' · accent'),
      makeSatellite(theme, 'background', labelFor(slug) + ' · bg'),
      makeSatellite(theme, 'foreground', labelFor(slug) + ' · fg')
    );
  }

  // "More"-Tile am Ende → scrollt hinauf zum Polygon-Picker
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'theme-tile tile-more';
  const remaining = THEMES.length - BENTO_THEMES.length;
  more.textContent = `+ ${remaining} weitere im Polygon-Picker ↑`;
  more.addEventListener('click', () => {
    if (pickerDemo) pickerDemo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  themesBento.appendChild(more);
}

renderBento();

// ---- cycle ----
function cycle() {
  const current = (picker && picker.value) || (currentSlug && currentSlug.textContent) || THEMES[0].slug;
  const i = THEMES.findIndex(t => t.slug === current);
  const next = THEMES[(i + 1) % THEMES.length];
  applyTheme(next.slug);
}
if (cycleBtn) cycleBtn.addEventListener('click', cycle);
if (picker) picker.addEventListener('change', () => applyTheme(picker.value));

// T-Taste → naechstes Theme (ausser Modifier gedrueckt oder Fokus in Input/SELECT).
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
    return localStorage.getItem('omarchy-theme') || THEMES[10].slug; // THEMES[10] = hermarchy (fallback)
  } catch (e) { return THEMES[0].slug; }
})();
applyTheme(initial, { persist: false });
