// Prueft i18n-Deckung: Key-Paritaet DE/EN + alle im HTML/JS benutzten Keys vorhanden.
// Laeuft in Node mit minimalen Browser-Stubs, weil i18n.js beim Import die
// localStorage/navigator-Detection ausfuehrt.
import fs from 'node:fs';
import path from 'node:path';

// Aufruf: node tools/i18n-check.mjs [verzeichnis]  (Default: Repo-Root = ..)
const dir = process.argv[2]
  || path.resolve(new URL('.', import.meta.url).pathname, '..');

globalThis.window = { location: { search: '', href: 'http://localhost/' }, history: { replaceState() {} } };
globalThis.localStorage = { getItem: () => null, setItem() {} };
// Node 26 hat navigator als Getter-only-Property → per defineProperty ueberschreiben.
Object.defineProperty(globalThis, 'navigator', { value: { language: 'de' }, configurable: true });
globalThis.document = {
  documentElement: { setAttribute() {} },
  querySelector: () => null,
  querySelectorAll: () => [],
  title: '',
};

const { STRINGS: S } = await import(new URL(`file://${path.resolve(dir, 'i18n.js')}`));

const de = new Set(Object.keys(S.de));
const en = new Set(Object.keys(S.en));

const html = fs.readFileSync(path.resolve(dir, 'index.html'), 'utf8');
const htmlKeys = new Set(
  [...html.matchAll(/data-i18n(?:-html|-aria-label|-title|-alt|-placeholder)?="([^"]+)"/g)].map((m) => m[1])
);

const js = fs.readFileSync(path.resolve(dir, 'app.js'), 'utf8');
const jsKeys = new Set([...js.matchAll(/tr\('([^']+)'/g)].map((m) => m[1]));

const problems = [];
for (const k of de) if (!en.has(k)) problems.push(`fehlt in en: ${k}`);
for (const k of en) if (!de.has(k)) problems.push(`fehlt in de: ${k}`);
for (const k of htmlKeys) if (!de.has(k) || !en.has(k)) problems.push(`HTML-Key unbekannt: ${k}`);
for (const k of jsKeys) if (!de.has(k) || !en.has(k)) problems.push(`JS-Key unbekannt: ${k}`);

const unused = [...de].filter((k) => !htmlKeys.has(k) && !jsKeys.has(k));

// Werte-Sanity: leere Strings, Keys die wie Keys aussehen, unbalancierte HTML-Tags
for (const lang of ['de', 'en']) {
  for (const [k, v] of Object.entries(S[lang])) {
    if (!String(v).trim()) problems.push(`${lang}/${k}: leerer Wert`);
    const open = (String(v).match(/<(code|em|strong|kbd)\b/g) || []).length;
    const close = (String(v).match(/<\/(code|em|strong|kbd)>/g) || []).length;
    if (open !== close) problems.push(`${lang}/${k}: Tag-Balance ${open}/${close}`);
  }
}

console.log(`Keys: de=${de.size} en=${en.size} html=${htmlKeys.size} js=${jsKeys.size}`);
console.log(`Unbenutzte Keys (ok, aber Doku): ${unused.length ? unused.join(', ') : '—'}`);
if (problems.length) {
  console.log('PROBLEME:');
  for (const p of problems) console.log(' - ' + p);
  process.exit(1);
}
console.log('ok — i18n vollstaendig und deckungsgleich');
