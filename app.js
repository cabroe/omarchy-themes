// omarchy-themes — Werkstatt-Landing-Page.
//
// Farben kommen ausschliesslich aus applyTheme(): alle abgeleiteten Tokens
// (Flaechen, Linien, gedimmter Text, Akzent-Text, Statusfarben) werden gegen die
// Flaeche gerechnet, auf der sie tatsaechlich liegen — 29 Paletten, 5 davon light.
//
// WICHTIG (Vertragsregel): die Farb-Helfer rechnen intern mit [r,g,b]-Tupeln und
// serialisieren erst am Ende zu Hex. Der frueher benutzte mix()->'rgb(...)' Pfad
// war mit parseHex() (nur Hex) unvertraeglich: jede Kontrastmessung auf einem
// Misch-Ergebnis las Luminanz 0 und lieferte still falsche Tokens.
//
// Tastatur: T = naechstes Theme, Shift+T = vorheriges, / = Launcher.

import { THEMES } from './themes.js';
// i18n als `tr`, weil in mehreren Schleifen `t` fuer ein Theme steht.
import { initI18n, onLangChange, t as tr } from './i18n.js';

// Default per Slug, nie per Index: `make generate` schreibt die Tabelle neu.
const DEFAULT_SLUG = 'tokyo-night';

// ---- DOM refs ----
const root        = document.documentElement;
const cycleBtns   = [document.getElementById('cycleBtn'), document.getElementById('cycleBtnDemo')].filter(Boolean);
const launcherBtns = [document.getElementById('launcherBtn'), document.getElementById('launcherBtnDemo')].filter(Boolean);
const statusSlug  = document.getElementById('statusSlug');
const statusMode  = document.getElementById('statusMode');
const roTheme     = document.getElementById('roTheme');
const roMode      = document.getElementById('roMode');
const grid        = document.getElementById('themeGrid');
const mockGrid    = document.getElementById('mockGrid');
const mockTotal   = document.getElementById('mockTotal');
const mockDark    = document.getElementById('mockDark');
const mockLight   = document.getElementById('mockLight');
const demoCount   = document.getElementById('demoCount');
const footCount   = document.getElementById('footCount');
const launcher    = document.getElementById('launcher');
const launcherPanel = document.getElementById('launcherPanel');
const launcherInput = document.getElementById('launcherInput');
const launcherList  = document.getElementById('launcherList');
const launcherCount = document.getElementById('launcherCount');

// Statische Strings uebersetzen + Sprach-Switcher verdrahten, BEVOR die
// dynamischen Listen (Select, Tiles, Launcher) gerendert werden.
initI18n();

// ---- Theme-Nachschlag ----
const bySlug = (slug) => THEMES.find((t) => t.slug === slug)
  || THEMES.find((t) => t.slug === DEFAULT_SLUG)
  || THEMES[0];

function labelFor(slug) {
  return String(slug).split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function modeLabel(theme) {
  return theme.mode === 'light' ? tr('mode.light') : tr('mode.dark');
}

function themeLabel(theme) {
  return labelFor(theme.slug) + ' · ' + modeLabel(theme);
}

// ==========================================================================
// Farbmathematik — [r,g,b]-Tupel
// ==========================================================================
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

// Nimmt Hex, rgb()/rgba() oder ein Tupel. Nie still [0,0,0] fuer gueltige Werte.
function parseColor(value) {
  if (Array.isArray(value)) return value.slice(0, 3).map(clampByte);
  if (typeof value !== 'string') return BLACK;
  const s = value.trim();
  const fn = s.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    const parts = fn[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) return parts.slice(0, 3).map(clampByte);
    return BLACK;
  }
  let h = s.replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(h)) return BLACK;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function toHex(tuple) {
  return '#' + tuple.slice(0, 3).map((v) => clampByte(v).toString(16).padStart(2, '0')).join('');
}

function mixTuple(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// 8-bit-Rundung wie CSS sie vornimmt: Kontrast wird auf dem GLEICHEN Wert
// geprueft, der spaeter als Token im Stylesheet landet (sonst rutschen Ziele
// wie 4.50 durch Quantisierung auf 4.47).
function q8(tuple) {
  return parseColor(toHex(tuple));
}

// Rec. 709 Luma (0..1), linearisiert per sRGB-Gamma.
function luminance(c) {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// Flaeche: accent so weit in bg mischen, bis der Kontrast zu bg das Ziel trifft.
function surface(bg, accent, target, start = 0.07, step = 0.03, cap = 0.22) {
  let t = Math.min(start, cap);
  let out = q8(mixTuple(bg, accent, t));
  while (t < cap && contrast(out, bg) < target) {
    t = Math.min(cap, t + step);
    out = q8(mixTuple(bg, accent, t));
  }
  return out;
}

// Kleinste Mischmenge Richtung `towards`, die gegen `base` das Ziel erreicht.
function mixToContrast(base, towards, target, step = 0.01, cap = 0.65) {
  let t = 0;
  let out = base;
  while (t < cap) {
    t = Math.min(cap, t + step);
    out = q8(mixTuple(base, towards, t));
    if (contrast(out, base) >= target) return out;
  }
  return out;
}

// Groesste Mischmenge Richtung Flaechenfarbe, die das Ziel noch haelt (so blass
// wie moeglich, aber nie unter dem Ziel).
function dimToContrast(fg, surf, target, step = 0.01) {
  let best = q8(fg);
  for (let t = step; t <= 1.0001; t += step) {
    const cand = q8(mixTuple(fg, surf, t));
    if (contrast(cand, surf) >= target) best = cand;
    else break;
  }
  return best;
}

// Farbe Richtung `towards` aufhellen, bis sie gegen `against` das Ziel haelt.
function liftTo(color, towards, against, target, step = 0.01, cap = 1.0) {
  if (contrast(color, against) >= target) return color;
  let t = 0;
  let out = q8(color);
  while (t < cap) {
    t = Math.min(cap, t + step);
    out = q8(mixTuple(color, towards, t));
    if (contrast(out, against) >= target) return out;
  }
  return out;
}

// Akzent als Textfarbe: erst pruefen, dann Richtung fg entsaettigen. Gemessen
// gegen --accent-wash-2, weil dort Tile-Ring und aktive Launcher-Zeile liegen.
function accentText(accent, fg, wash2, target = 4.5, cap = 0.75) {
  if (contrast(accent, wash2) >= target) return accent;
  const lifted = liftTo(accent, fg, wash2, target, 0.01, cap);
  return contrast(lifted, wash2) >= target ? lifted : fg;
}

// Beste Vordergrundfarbe auf einer Fuellflaeche (ersetzt hartcodiertes '#0d1117').
function pickOnColor(fill) {
  let best = BLACK;
  let bestRatio = -1;
  for (const candidate of [WHITE, BLACK]) {
    const ratio = contrast(fill, candidate);
    if (Number.isFinite(ratio) && ratio > bestRatio) {
      bestRatio = ratio;
      best = candidate;
    }
  }
  return best;
}

function bgOf(theme) {
  return parseColor(theme.c.background || theme.c.dark_background || '#1a1b26');
}

function fgOf(theme) {
  return parseColor(theme.c.foreground || theme.c.dark_foreground || '#a9b1d6');
}

function accentOf(theme) {
  return parseColor(theme.c.accent || theme.c.blue || '#7aa2f7');
}

// ==========================================================================
// Theme anwenden
// ==========================================================================
let activeSlug = null;

function applyTheme(slug, { persist = true } = {}) {
  const theme = bySlug(slug);
  const bg = bgOf(theme);
  const fg = fgOf(theme);
  const accent = accentOf(theme);

  // Flaechen liegen unter Text -> sie zuerst, danach die Textfarben dagegen rechnen.
  const elev = surface(bg, accent, 1.10);
  const elev2 = surface(bg, accent, 1.18, 0.13);
  const wash = q8(mixTuple(bg, accent, 0.10));
  const wash2 = q8(mixTuple(bg, accent, 0.18));

  const border = mixToContrast(bg, fg, 1.5, 0.01, 0.65);
  const borderStrong = mixToContrast(bg, fg, 3.0, 0.01, 0.65);

  // --fg-muted liegt auf --bg (Topbar/Captions), --bg-elev (kbd-Chip) UND
  // --accent-wash-2 (aktives Tile, gewaehlte Launcher-Zeile). wash-2 ist die
  // accent-staerkste Flaeche -> gegen sie gerechnet haelt der Ton automatisch
  // auch auf bg und bg-elev.
  const fgMuted = dimToContrast(fg, wash2, 4.5);
  const accentTxt = accentText(accent, fg, wash2);
  const accentFg = pickOnColor(accent);

  const selection = theme.c.selection ? parseColor(theme.c.selection) : wash2;
  const selectionFg = pickOnColor(selection);

  const set = (name, value) => root.style.setProperty(name, value);
  set('--bg', toHex(bg));
  set('--bg-elev', toHex(elev));
  set('--bg-elev-2', toHex(elev2));
  set('--fg', toHex(fg));
  set('--fg-muted', toHex(fgMuted));
  set('--border', toHex(border));
  set('--border-strong', toHex(borderStrong));
  set('--accent', toHex(accent));
  set('--accent-text', toHex(accentTxt));
  set('--accent-fg', toHex(accentFg));
  set('--accent-wash', toHex(wash));
  set('--accent-wash-2', toHex(wash2));
  set('--selection', toHex(selection));
  set('--selection-fg', toHex(selectionFg));

  root.setAttribute('data-theme', theme.slug);
  root.style.colorScheme = theme.mode === 'light' ? 'light' : 'dark';

  activeSlug = theme.slug;
  updateReadout();
  syncPressed(theme.slug);

  if (persist) {
    try { localStorage.setItem('omarchy-theme', theme.slug); } catch (e) { /* privater Modus */ }
  }

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute('content', toHex(bg));
}

// Readout in der Topbar (aria-live) + Werte im Flow-Readout.
function updateReadout() {
  const theme = bySlug(activeSlug);
  const mode = modeLabel(theme);
  if (statusSlug) statusSlug.textContent = theme.slug;
  if (statusMode) statusMode.textContent = mode;
  if (roTheme) roTheme.textContent = theme.slug;
  if (roMode) roMode.textContent = mode;
}

// ---- aria-pressed aller Tiles auf den aktiven Slug setzen ----
function syncPressed(slug) {
  if (grid) {
    for (const tile of grid.querySelectorAll('.tile')) {
      tile.setAttribute('aria-pressed', String(tile.dataset.slug === slug));
    }
  }
  if (mockGrid) {
    for (const card of mockGrid.querySelectorAll('.mock-card')) {
      card.setAttribute('aria-pressed', String(card.dataset.slug === slug));
    }
  }
}

// ==========================================================================
// Mockup: der Hermes-Picker als DOM (siehe .mock im Stylesheet)
// ==========================================================================
// Warum DOM statt <img>: das Fenster besteht aus denselben Tokens, die
// applyTheme() setzt. Ein Klack im Tile-Grid faerbt es damit ohne Zusatzcode
// mit — kein 350-kB-Bild, das bei jedem Theme falsch waere.
//
// Die Karten sind nur per Maus bedienbar (tabindex="-1"): der Container steht
// als role="img", die echte Tastatur-Steuerung liegt beim #themeGrid. Sonst
// haetten wir dieselben 29 Themes zweimal im Tab-Order.
function renderMockCards() {
  if (!mockGrid) return;
  const frag = document.createDocumentFragment();
  for (const theme of THEMES) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mock-card';
    card.dataset.slug = theme.slug;
    card.tabIndex = -1;
    card.setAttribute('aria-pressed', 'false');

    const head = document.createElement('span');
    head.className = 'mock-card-head';

    const name = document.createElement('span');
    name.className = 'mock-card-name';
    name.textContent = labelFor(theme.slug);

    const mode = document.createElement('span');
    mode.className = 'mock-card-mode';
    head.append(name, mode);

    const swatches = document.createElement('span');
    swatches.className = 'mock-card-swatches';
    swatches.setAttribute('aria-hidden', 'true');
    for (const color of [theme.c.accent, theme.c.background || theme.c.dark_background, theme.c.foreground]) {
      const cell = document.createElement('span');
      cell.style.background = color || 'transparent';
      swatches.append(cell);
    }

    const apply = document.createElement('span');
    apply.className = 'mock-card-apply';
    apply.textContent = tr('mock.apply');
    apply.setAttribute('aria-hidden', 'true');

    card.append(head, swatches, apply);
    card.addEventListener('click', () => applyTheme(theme.slug));
    frag.append(card);
  }
  mockGrid.append(frag);
  relabelMock();
}

function relabelMock() {
  if (!mockGrid) return;
  for (const card of mockGrid.querySelectorAll('.mock-card')) {
    const theme = bySlug(card.dataset.slug);
    const modeEl = card.querySelector('.mock-card-mode');
    if (modeEl) modeEl.textContent = modeLabel(theme);
  }
  // Zaehler im About-Mockup kommen aus THEMES, nicht aus dem HTML:
  // `make generate` aendert die Tabelle, dann stimmen sie automatisch.
  if (mockTotal) mockTotal.textContent = String(THEMES.length);
  if (mockDark) mockDark.textContent = String(THEMES.filter((t) => t.mode !== 'light').length);
  if (mockLight) mockLight.textContent = String(THEMES.filter((t) => t.mode === 'light').length);
}

renderMockCards();

// ==========================================================================
// Theme-Tiles (Demo) — einmal gebaut, beim Sprachwechsel nur neu beschriftet
// ==========================================================================
function renderTiles() {
  if (!grid) return;
  const frag = document.createDocumentFragment();
  for (const theme of THEMES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile';
    btn.dataset.slug = theme.slug;
    btn.setAttribute('aria-pressed', 'false');

    const swatch = document.createElement('span');
    swatch.className = 'tile-swatch';
    swatch.setAttribute('aria-hidden', 'true');
    for (const color of [theme.c.accent, theme.c.background || theme.c.dark_background, theme.c.foreground]) {
      const cell = document.createElement('span');
      cell.style.background = color || 'transparent';
      swatch.append(cell);
    }

    const slugEl = document.createElement('span');
    slugEl.className = 'tile-slug';
    slugEl.textContent = theme.slug;

    const modeEl = document.createElement('span');
    modeEl.className = 'tile-mode';

    btn.append(swatch, slugEl, modeEl);
    btn.addEventListener('click', () => applyTheme(theme.slug));
    frag.append(btn);
  }
  grid.append(frag);
  relabelTiles();
}

function relabelTiles() {
  if (grid) {
    for (const tile of grid.querySelectorAll('.tile')) {
      const theme = bySlug(tile.dataset.slug);
      const modeEl = tile.querySelector('.tile-mode');
      if (modeEl) modeEl.textContent = modeLabel(theme);
      tile.title = themeLabel(theme);
      tile.setAttribute('aria-label', tr('tile.aria', { name: labelFor(theme.slug) }));
    }
  }
  const n = THEMES.length;
  if (demoCount) demoCount.textContent = tr('demo.count', { n });
  if (footCount) footCount.textContent = tr('demo.count', { n });
}

renderTiles();

// ==========================================================================
// Theme wechseln
// ==========================================================================
function cycle(dir = 1) {
  const i = THEMES.findIndex((t) => t.slug === activeSlug);
  const next = THEMES[(i + dir + THEMES.length) % THEMES.length];
  applyTheme(next.slug);
}

for (const btn of cycleBtns) btn.addEventListener('click', () => cycle(1));

// ==========================================================================
// Launcher (/)
// ==========================================================================
let launcherOpen = false;
let launcherIndex = 0;
let launcherMatches = [];
let launcherTrigger = null;

// Ausserhalb des modalen Dialogs: Header, Main, Footer und Skip-Link inert
// setzen, damit Fokus und Screenreader im Launcher bleiben (aria-modal).
const inertTargets = [
  document.querySelector('header.topbar'),
  document.getElementById('main'),
  document.querySelector('footer.foot'),
  document.querySelector('.skip-link'),
].filter(Boolean);

function openLauncher(trigger) {
  if (!launcher || launcherOpen) return;
  launcherTrigger = trigger || document.activeElement;
  launcherOpen = true;
  launcher.hidden = false;
  launcherIndex = 0;
  for (const el of inertTargets) el.inert = true;
  document.body.classList.add('launcher-open');
  if (launcherInput) {
    launcherInput.value = '';
    filterLauncher('');
    launcherInput.focus();
  }
  for (const btn of launcherBtns) btn.setAttribute('aria-expanded', 'true');
}

function closeLauncher({ restore = true } = {}) {
  if (!launcher || !launcherOpen) return;
  launcherOpen = false;
  launcher.hidden = true;
  for (const el of inertTargets) el.inert = false;
  document.body.classList.remove('launcher-open');
  for (const btn of launcherBtns) btn.setAttribute('aria-expanded', 'false');
  if (restore && launcherTrigger && typeof launcherTrigger.focus === 'function') launcherTrigger.focus({ preventScroll: true });
}

function filterLauncher(query) {
  const needle = query.trim().toLowerCase();
  launcherMatches = THEMES.filter((t) => !needle || t.slug.toLowerCase().includes(needle));
  launcherIndex = Math.min(launcherIndex, Math.max(0, launcherMatches.length - 1));
  renderLauncher();
}

function renderLauncher() {
  if (!launcherList || !launcherInput) return;
  launcherList.replaceChildren();

  if (!launcherMatches.length) {
    const empty = document.createElement('li');
    empty.className = 'launcher-empty';
    empty.setAttribute('role', 'presentation');
    empty.textContent = tr('launcher.empty');
    launcherList.append(empty);
    launcherInput.removeAttribute('aria-activedescendant');
  } else {
    launcherMatches.forEach((theme, i) => {
      const row = document.createElement('li');
      row.className = 'launcher-row';
      row.id = 'launcher-opt-' + theme.slug;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(i === launcherIndex));
      row.dataset.index = String(i);

      const chip = document.createElement('span');
      chip.className = 'launcher-chip';
      chip.style.background = theme.c.accent || 'transparent';
      chip.setAttribute('aria-hidden', 'true');

      const slugEl = document.createElement('span');
      slugEl.className = 'launcher-slug';
      slugEl.textContent = theme.slug;

      const modeEl = document.createElement('span');
      modeEl.className = 'launcher-mode';
      modeEl.textContent = modeLabel(theme);

      row.append(chip, slugEl, modeEl);
      row.addEventListener('mousedown', (e) => e.preventDefault());
      row.addEventListener('click', () => chooseLauncher(i));
      launcherList.append(row);
    });

    const active = launcherMatches[launcherIndex];
    launcherInput.setAttribute('aria-activedescendant', 'launcher-opt-' + active.slug);
    const activeRow = launcherList.children[launcherIndex];
    if (activeRow && typeof activeRow.scrollIntoView === 'function') {
      activeRow.scrollIntoView({ block: 'nearest' });
    }
  }

  if (launcherCount) {
    launcherCount.textContent = tr('launcher.count', { n: launcherMatches.length, m: THEMES.length });
  }
}

function setLauncherIndex(next) {
  if (!launcherMatches.length) return;
  launcherIndex = Math.max(0, Math.min(launcherMatches.length - 1, next));
  renderLauncher();
}

function chooseLauncher(index) {
  const theme = launcherMatches[index];
  if (!theme) return;
  applyTheme(theme.slug);
  closeLauncher();
}

for (const btn of launcherBtns) {
  btn.addEventListener('click', () => openLauncher(btn));
  btn.setAttribute('aria-expanded', 'false');
}

if (launcher) {
  launcher.addEventListener('click', (e) => {
    if (e.target === launcher) closeLauncher();
  });
}

if (launcherInput) {
  launcherInput.addEventListener('input', () => {
    launcherIndex = 0;
    filterLauncher(launcherInput.value);
  });

  launcherInput.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setLauncherIndex(launcherIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setLauncherIndex(launcherIndex - 1);
        break;
      case 'Home':
        e.preventDefault();
        setLauncherIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setLauncherIndex(launcherMatches.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        chooseLauncher(launcherIndex);
        break;
      case 'Escape':
        e.preventDefault();
        closeLauncher();
        break;
      case 'Tab':
        // Fokus-Trap: der Dialog hat genau ein fokussierbares Element.
        e.preventDefault();
        break;
      default:
        break;
    }
  });
}

if (launcherPanel) {
  launcherPanel.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && launcherInput) {
      e.preventDefault();
      launcherInput.focus();
    }
  });
}

// ==========================================================================
// Globale Tastatur
// ==========================================================================
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (e.target && e.target.tagName) || '';
  const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);

  if ((e.key === 't' || e.key === 'T') && !inField && !launcherOpen) {
    e.preventDefault();
    cycle(e.shiftKey ? -1 : 1);
    return;
  }
  if (e.key === '/' && !inField && !launcherOpen) {
    e.preventDefault();
    openLauncher(launcherBtns[0] || null);
  }
});

// ---- init ----
const initial = (() => {
  try {
    return localStorage.getItem('omarchy-theme') || DEFAULT_SLUG;
  } catch (e) {
    return DEFAULT_SLUG;
  }
})();
applyTheme(initial, { persist: false });

// ---- Sprachwechsel: nur noch die verbliebenen dynamischen Labels ----
// applyI18n() hat die statischen Strings bereits gesetzt; hier folgen
// Select-Optionen, Tile-Beschriftungen, Zaehler und der Readout.
function relabel() {
  relabelTiles();
  relabelMock();
  if (launcherOpen) renderLauncher();
  if (activeSlug) updateReadout();
  if (activeSlug) syncPressed(activeSlug);
}
onLangChange(relabel);
