// Anti-Slop- und Plattform-Check fuer die Pages-Site.
// Aufruf: node tools/slop-check.mjs [verzeichnis]   (Default: Repo-Root)
// Bewusst grep-basiert: findet Muster unabhaengig davon, ob ein Agent behauptet,
// sie entfernt zu haben. Exit 1, wenn ein Hard-Gate verletzt ist.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2]
  || path.resolve(new URL('.', import.meta.url).pathname, '..');

const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
// CSS-Kommentare strippen: erwaente Verbote ("kein backdrop-filter") sind keine Verstoesse.
const stripCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
const cssRaw = read('styles.css');
const css = stripCssComments(cssRaw);
const html = read('index.html');
const app = read('app.js');
const all = `${html}\n${app}\n${css}`;

const hard = [];
const soft = [];
const ok = [];

// ---------- 1. Verlaeufe / Glas / Blur ----------
const gradients = [...css.matchAll(/(linear|radial|conic)-gradient\(/g)].length;
gradients === 0 ? ok.push('keine CSS-Verlaeufe') : hard.push(`${gradients}x gradient() in styles.css`);

const blur = [...css.matchAll(/backdrop-filter|(?<![\w-])blur\(/g)].length;
blur === 0 ? ok.push('kein backdrop-filter/blur') : hard.push(`${blur}x backdrop-filter/blur`);

// ---------- 2. Radien ----------
const radii = [...css.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim());
const bigRadii = radii.filter((v) => {
  const px = /^(\d+(?:\.\d+)?)px$/.exec(v);
  const rem = /^(\d+(?:\.\d+)?)rem$/.exec(v);
  if (v === '50%' || v === '999px' || v.includes('999')) return true;
  if (px) return parseFloat(px[1]) > 4;
  if (rem) return parseFloat(rem[1]) > 0.25;
  return false;
});
bigRadii.length === 0
  ? ok.push(`Radien <= 4px (${radii.length} Deklarationen)`)
  : hard.push(`Radien > 4px: ${[...new Set(bigRadii)].join(', ')}`);

// ---------- 3. Schatten ----------
const shadows = [...css.matchAll(/box-shadow:\s*([^;]+);/g)].map((m) => m[1].trim());
shadows.length <= 1
  ? ok.push(`${shadows.length} box-shadow (max 1 erlaubt)`)
  : soft.push(`${shadows.length} box-shadow — Spec erlaubt nur den Dialog: ${shadows.slice(0, 3).join(' | ')}`);

// ---------- 4. Externe Assets ----------
const externals = [
  ...html.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g),
  ...css.matchAll(/url\((?:"|')?(https?:)?\/\/[^)"']+/g),
].map((m) => m[0]);
const filtered = externals.filter((u) => !/^href="https:\/\/github\.com\/cabroe\/omarchy-themes/.test(u) && !/^href="https:\/\/cabroe\.github\.io/.test(u));
filtered.length === 0
  ? ok.push('keine externen Assets (nur Repo-Links)')
  : hard.push(`externe Referenzen: ${filtered.slice(0, 5).join(', ')}`);

const fontFace = /@font-face|fonts\.(googleapis|gstatic)|use\.typekit/.test(all);
fontFace ? hard.push('Webfont-Referenz gefunden') : ok.push('keine Webfonts');

// ---------- 5. Emoji (Deko-Icons) ----------
// Whitelist = die in Spec §5 erlaubten Glyphen. Alles andere in den Emoji-Ranges
// gilt als Deko-Icon.
const ALLOWED_GLYPHS = new Set(['❯', '→', '↗', '↵', '↑', '↓', '·', '▾', '▴']);
const emoji = [...all.matchAll(/[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{25A0}-\u{25FF}]/gu)]
  .map((m) => m[0])
  .filter((c) => !ALLOWED_GLYPHS.has(c));
emoji.length === 0
  ? ok.push('keine Deko-Emoji (nur erlaubte Glyphen)')
  : hard.push(`Emoji gefunden: ${[...new Set(emoji)].join(' ')} (${emoji.length}x)`);

// ---------- 6. Schriftgroessen ausserhalb der Token-Skala ----------
const sizes = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
const literal = sizes.filter((v) => /^\d/.test(v));
literal.length === 0
  ? ok.push(`font-size nur ueber Tokens (${sizes.length} Deklarationen)`)
  : soft.push(`${literal.length}x literale font-size (Spec: nur 8 Tokens): ${[...new Set(literal)].slice(0, 6).join(', ')}`);

// ---------- 7. A11y-/Struktur-Punkte aus dem Review ----------
const checks = [
  ['Skip-Link-Ziel existiert', (() => {
    const m = /class="skip-link"[^>]*href="#([\w-]+)"/.exec(html) || /href="#([\w-]+)"[^>]*class="skip-link"/.exec(html);
    return m && new RegExp(`id="${m[1]}"`).test(html);
  })()],
  ['focus-visible definiert', /:focus-visible/.test(css)],
  ['prefers-reduced-motion', /prefers-reduced-motion/.test(css)],
  ['scroll-padding-top (Sticky-Header)', /scroll-padding-top/.test(css)],
  ['Launcher-Listbox-ARIA', /role="listbox"/.test(html) && /aria-activedescendant/.test(all)],
  ['Launcher-Dialog-ARIA', /role="dialog"/.test(html) && /aria-modal="true"/.test(html)],
  ['Default-Theme per Slug aufgeloest', (() => {
    const slugDefault = /(?:DEFAULT[_A-Z]*\s*=\s*['"`]tokyo-night['"`])|(?:slug\s*===\s*['"`]tokyo-night['"`])|(?:bySlug\(\s*['"`]tokyo-night['"`]\s*\))/.test(app);
    return slugDefault && !/THEMES\[27\]/.test(app);
  })()],
];
for (const [name, pass] of checks) {
  pass ? ok.push(name) : hard.push(`fehlt: ${name}`);
}

// ---------- 8. Theme-Faehigkeit: Tokens an :root gesetzt ----------
// Tokens duerfen ueber einen Helper laufen (`const set = (n,v) => root.style.setProperty(n,v)`),
// deshalb zaehlt jedes quoted Vorkommen des Tokennamens im Theme-Pfad.
const requiredTokens = ['--bg', '--bg-elev', '--fg', '--fg-muted', '--border', '--accent'];
const missingTokens = requiredTokens.filter((t) => !new RegExp(`['"\`]${t}['"\`]`).test(app));
const setProps = [...app.matchAll(/['"`](--[a-z0-9-]+)['"`]\s*,/g)].map((m) => m[1]);
missingTokens.length === 0
  ? ok.push(`applyTheme setzt alle Kern-Tokens (${new Set(setProps).size} Token-Namen im Theme-Pfad)`)
  : hard.push(`applyTheme setzt nicht: ${missingTokens.join(', ')}`);

// ---------- Ausgabe ----------
console.log(`\n== ${path.resolve(dir)} ==`);
console.log(`OK (${ok.length})`);
for (const o of ok) console.log('  ✓ ' + o);
if (soft.length) { console.log(`\nWEICH (${soft.length})`); for (const s of soft) console.log('  ~ ' + s); }
if (hard.length) { console.log(`\nHARD-GATE VERLETZT (${hard.length})`); for (const h of hard) console.log('  ✗ ' + h); }
console.log(`\nErgebnis: ${hard.length === 0 ? 'PASS' : 'FAIL'} (${hard.length} hart, ${soft.length} weich)`);
process.exit(hard.length === 0 ? 0 : 1);
