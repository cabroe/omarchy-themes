// Kontrast-Check: verifiziert die in app.js berechneten Text-Tokens gegen die
// Flaechen, auf denen sie tatsaechlich liegen, ueber alle 20 Paletten.
// Aufruf: node tools/contrast-check.mjs [verzeichnis]   (Default: Repo-Root)
//
// Warum dieses Werkzeug existiert: der fruehere Harness pruefte --fg-muted nur
// gegen --bg-elev und meldete deshalb "0 Fehlschlaenge", obwohl das aktive Tile
// (.tile-mode) und die gewaehlte Launcher-Zeile (.launcher-mode) auf
// --accent-wash-2 liegen und dort 3.35-4.45 statt >= 4.5 erreichten.
//
// Gepruefte Paare (die tatsaechlich zusammen auftreten, Ziel 4.7):
//   --fg-muted    vs --bg, --bg-elev, --accent-wash-2
//   --accent-text vs --bg, --accent-wash, --accent-wash-2
// Hinweis: --ok/--warn/--err wurden mit S9 entfernt (keine Nutzung, kein
// Status-Zustand auf der statischen Seite). Falls sie je zurueckkehren, hier
// `--ok/--warn/--err vs --bg` ergaenzen.
// Exit 1 bei Verstoss.

import path from 'node:path';

const dir = process.argv[2]
  || path.resolve(new URL('.', import.meta.url).pathname, '..');

const { THEMES } = await import(new URL(`file://${path.resolve(dir, 'themes.js')}`));

// ---- Farbmathematik (1:1 aus app.js kopiert, damit die Pruefung exakt die
//      Werte nachrechnet, die spaeter als CSS-Tokens landen) ----
const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));

function parseColor(value) {
  if (Array.isArray(value)) return value.slice(0, 3).map(clampByte);
  if (typeof value !== 'string') return [0, 0, 0];
  const s = value.trim();
  const fn = s.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    const parts = fn[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) return parts.slice(0, 3).map(clampByte);
    return [0, 0, 0];
  }
  let h = s.replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const toHex = (t) => '#' + t.slice(0, 3).map((v) => clampByte(v).toString(16).padStart(2, '0')).join('');
const mixTuple = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const q8 = (t) => parseColor(toHex(t));

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
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function surface(bg, accent, target, start = 0.07, step = 0.03, cap = 0.22) {
  let t = Math.min(start, cap);
  let out = q8(mixTuple(bg, accent, t));
  while (t < cap && contrast(out, bg) < target) {
    t = Math.min(cap, t + step);
    out = q8(mixTuple(bg, accent, t));
  }
  return out;
}

function dimToContrast(fg, surf, target, step = 0.01) {
  let best = q8(fg);
  for (let t = step; t <= 1.0001; t += step) {
    const cand = q8(mixTuple(fg, surf, t));
    if (contrast(cand, surf) >= target) best = cand;
    else break;
  }
  return best;
}

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

function accentText(accent, fg, wash2, target = 4.7, cap = 0.75) {
  if (contrast(accent, wash2) >= target) return accent;
  const lifted = liftTo(accent, fg, wash2, target, 0.01, cap);
  return contrast(lifted, wash2) >= target ? lifted : fg;
}

const bgOf = (t) => parseColor(t.c.background || t.c.dark_background || '#1a1b26');
const fgOf = (t) => parseColor(t.c.foreground || t.c.dark_foreground || '#a9b1d6');
const accentOf = (t) => parseColor(t.c.accent || t.c.blue || '#7aa2f7');

// ---- Pruefung ----
const TARGET = 4.7;
let violations = 0;
let worst = { ratio: Infinity, slug: '', pair: '' };

for (const theme of THEMES) {
  const bg = bgOf(theme);
  const fg = fgOf(theme);
  const accent = accentOf(theme);

  const elev = surface(bg, accent, 1.10);
  const wash = q8(mixTuple(bg, accent, 0.10));
  const wash2 = q8(mixTuple(bg, accent, 0.18));

  const fgMuted = dimToContrast(fg, wash2, TARGET);
  const accentTxt = accentText(accent, fg, wash2);

  const pairs = [
    ['--fg-muted', '--bg', contrast(fgMuted, bg)],
    ['--fg-muted', '--bg-elev', contrast(fgMuted, elev)],
    ['--fg-muted', '--accent-wash-2', contrast(fgMuted, wash2)],
    ['--accent-text', '--bg', contrast(accentTxt, bg)],
    ['--accent-text', '--accent-wash', contrast(accentTxt, wash)],
    ['--accent-text', '--accent-wash-2', contrast(accentTxt, wash2)],
  ];

  for (const [tok, surf, ratio] of pairs) {
    if (ratio < worst.ratio) worst = { ratio, slug: theme.slug, pair: `${tok} on ${surf}` };
    if (ratio < TARGET) {
      violations++;
      console.log(`FAIL ${theme.slug.padEnd(16)} ${tok} on ${surf}: ${ratio.toFixed(2)} (Soll ${TARGET})`);
    }
  }
}

console.log(`\nKontrast-Pruefung: ${THEMES.length} Paletten x ${6} Paare, Soll ${TARGET}`);
console.log(`Schwaechster Wert: ${worst.ratio.toFixed(2)}  (${worst.slug}, ${worst.pair})`);
if (violations) {
  console.log(`${violations} Verstoesse`);
  process.exit(1);
}
console.log(`ok — alle Text-Tokens halten AA 4.7 gegen ihre tatsaechlichen Flaechen`);
