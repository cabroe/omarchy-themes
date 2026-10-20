// omarchy-themes — i18n fuer die Plugin-Story-Homepage.
//
// Eine Quelle, zwei Sprachen: Deutsch ist die Referenz (exakt der bisherige
// Seitentext), Englisch ist die Uebersetzung. Kein Build-Step, kein Netzwerk:
// die Strings liegen inline, die Sprache kommt aus ?lang=, localStorage oder
// der Browsersprache (en* -> en, alles andere -> de).
//
// Key-Deckung pruefen: `node tools/i18n-check.mjs`.

export const LANGS = ['de', 'en'];

export const STRINGS = {
  de: {
    'meta.title': 'omarchy-themes · Hermes-nativ',
    'meta.description': 'Omarchy-Paletten, Hermes-nativ — Plugin für Desktop, ⌘K und CLI/TUI-Skin. Bidirektionaler Sync, ein Plugin, drei Komponenten.',
    'a11y.skip': 'Zum Inhalt springen',
    'lang.groupAria': 'Sprache',

    'nav.flow': 'Flow',
    'nav.components': 'Komponenten',
    'nav.demo': 'Demo',
    'nav.install': 'Install',

    'hero.tag.plugin': 'Hermes Desktop plugin',
    'hero.tag.bridge': 'Omarchy theme bridge',
    'hero.title': 'Omarchy-Themes, Hermes-nativ.',
    'hero.lede': 'Ein <code>omarchy</code>-Theme-Set — und Desktop-Picker, ⌘K und CLI/TUI-Skin wechseln synchron. Ein Plugin, drei Komponenten, eine Wahrheit pro Klick.',
    'hero.cycle': 'Cycle theme →',
    'hero.pickTheme': 'Pick theme ▾',
    'hero.pickThemeOpen': 'Pick theme ▴',
    'hero.selectAria': 'Theme auswählen',
    'hero.gridAria': 'Theme-Auswahl',
    'hero.hintLabel': 'Aktuelles Theme:',

    'arch.h2': 'Bidirektionaler Sync. Eine Wahrheit pro Klick.',
    'arch.lede': '<code>omarchy theme set</code> schreibt über den Hook ins Hermes-Skin-File. Der Hermes-Picker ruft denselben <code>skin use</code>-Pfad zurück. Pro Aktion gewinnt genau eine Seite.',
    'arch.flowAria': 'Theme-Sync-Flow',
    'arch.cli.tag': 'Omarchy CLI',
    'arch.cli.note': 'Source-of-Truth für Theme-Colors via <code>colors.toml</code> (User &gt; System &gt; current).',
    'arch.mid.tag': 'omarchy-themes',
    'arch.mid.note': 'Hook schreibt <code>~/.hermes/skins/nord.yaml</code> (22 Keys, hex 3- oder 6-stellig), Plugin registriert die Palette im Picker und ⌘K.',
    'arch.dst.tag': 'Hermes UI',
    'arch.dst.note': 'Desktop, CLI, TUI — alles in einem Schritt umgefärbt (light/dark + Accent via Rec.709-Luma-Synth).',

    'comp.h2': 'Drei Komponenten, ein Theme-Flow.',
    'comp.lede': 'Desktop-Plugin registriert die Paletten. Hook synct sie ins Hermes-Skin-File. Generator frischt sie nach jedem Omarchy-Update auf.',
    'comp.anatomy': 'Keine der drei Komponenten ist optional — wer nur den Desktop-Picker will, kommt mit Plugin + Generator aus; wer auch CLI/TUI mitsyncen will, ergänzt den Hook.',
    'comp.plugin.tag': 'Plugin',
    'comp.plugin.h3': 'Desktop plugin',
    'comp.plugin.body': 'Registriert jede Omarchy-Palette im Hermes-Picker, als ⌘K-Befehl (<em>Apply Omarchy Theme: &lt;Name&gt;</em>) und auf einer Settings-Karte mit Swatches, Filter und Apply. Jedes Theme bringt Light- und Dark-Palette mit; Brand-Accent wird geteilt, die Gegenpalette wird synthetisiert.',
    'comp.hook.tag': 'Hook',
    'comp.hook.h3': 'Omarchy theme-set hook',
    'comp.hook.body': 'Läuft bei jedem <code>omarchy theme set &lt;slug&gt;</code>. Parst die <code>colors.toml</code> (User &gt; System &gt; current), schreibt <code>~/.hermes/skins/&lt;slug&gt;.yaml</code> und aktiviert den Skin via <code>hermes skin use</code>. Reines POSIX-sh, kein Python, exit 0 immer.',
    'comp.gen.tag': 'Generator',
    'comp.gen.h3': 'Theme-table generator',
    'comp.gen.body': 'Liest <code>colors.toml</code> aus <code>/usr/share/omarchy/themes/</code> (mit <code>--include-user</code> auch aus <code>~/.config/omarchy/themes/</code>) und schreibt den <code>// BEGIN GENERATED THEMES … // END GENERATED THEMES</code>-Block in <code>desktop/plugin.js</code> neu. <code>HOST=&lt;ssh&gt;</code> liest aus der Ferne.',

    'demo.h2': 'Probier\u2019s aus.',
    'demo.lede': '29 Standard-Paletten, 5 Light + 24 Dark. Cycle-Button oder Picker — die ganze Seite färbt sich mit, Light/Dark inklusive. Drücke <kbd>T</kbd>, um durch alle Themes zu cyclen.',
    'demo.sub1': 'Polygon-Picker — alle 29',
    'demo.gridAria': 'Theme-Auswahl — alle 29 Themes',
    'demo.sub2': 'Bento — 12 Defaults',
    'demo.bentoAria': 'Theme-Bento',

    'install.h2': 'In 30 Sekunden drin.',
    'install.lede': 'Plugin und Hook sind zwei voneinander unabhängige Pfade. Plugin läuft nach Reload, Hook nach <code>make install-hook</code>. Beide idempotent.',
    'install.plugin.tag': '1. Plugin',
    'install.plugin.meta': 'in ~3 s · via Hermes CLI',
    'install.plugin.note': 'Anschließend Hermes Desktop neu laden, ⌘K → <em>Reload desktop plugins</em>. In <em>Settings → Capabilities → Plugins → omarchy-themes</em> einmalig aktivieren.',
    'install.hook.tag': '2. Hook',
    'install.hook.meta': 'idempotent · aus Plugin-Root',
    'install.hook.note': 'Kopiert <code>hooks/hermes-skin-sync.sh</code> nach <code>~/.config/omarchy/hooks/theme-set.d/</code>. Re-run jederzeit möglich (überschreibt). Undo mit <code>make uninstall</code>.',
    'install.extras': '<strong>Auto-Sync ausschalten:</strong> <code>touch ~/.local/state/omarchy/toggles/skip-hermes-theme-changes</code> — Picker und ⌘K bleiben funktional, der Hook triggert nur nicht mehr.',

    'foot.readme': 'README →',
    'foot.branch': 'branch: main',
    'foot.ci': 'CI status →',
    'foot.ciMeta': 'lint + tests on push',
    'foot.tagline': 'Omarchy palettes, Hermes-native.',

    'mode.light': 'light',
    'mode.dark': 'dark',
    'bento.more': '+ {n} weitere im Polygon-Picker ↑',
    'bento.activate': 'Theme {name} aktivieren',
  },

  en: {
    'meta.title': 'omarchy-themes · Hermes-native',
    'meta.description': 'Omarchy colour schemes in Hermes — a plugin for the desktop, ⌘K and the CLI/TUI skin. Bidirectional sync, one plugin, three components.',
    'a11y.skip': 'Skip to content',
    'lang.groupAria': 'Language',

    'nav.flow': 'Flow',
    'nav.components': 'Components',
    'nav.demo': 'Demo',
    'nav.install': 'Install',

    'hero.tag.plugin': 'Hermes Desktop plugin',
    'hero.tag.bridge': 'Omarchy theme bridge',
    'hero.title': 'Omarchy themes, Hermes-native.',
    'hero.lede': 'One <code>omarchy</code> theme set — and the desktop picker, ⌘K and the CLI/TUI skin switch in sync. One plugin, three components, one source of truth per click.',
    'hero.cycle': 'Cycle theme →',
    'hero.pickTheme': 'Pick theme ▾',
    'hero.pickThemeOpen': 'Pick theme ▴',
    'hero.selectAria': 'Select theme',
    'hero.gridAria': 'Theme selection',
    'hero.hintLabel': 'Current theme:',

    'arch.h2': 'Bidirectional sync. One source of truth per click.',
    'arch.lede': '<code>omarchy theme set</code> writes into the Hermes skin file through the hook. The Hermes picker calls back into the same <code>skin use</code> path. Exactly one side wins per action.',
    'arch.flowAria': 'Theme sync flow',
    'arch.cli.tag': 'Omarchy CLI',
    'arch.cli.note': 'Source of truth for theme colours via <code>colors.toml</code> (user &gt; system &gt; current).',
    'arch.mid.tag': 'omarchy-themes',
    'arch.mid.note': 'Hook writes <code>~/.hermes/skins/nord.yaml</code> (22 keys, 3- or 6-digit hex); the plugin registers the palette in the picker and ⌘K.',
    'arch.dst.tag': 'Hermes UI',
    'arch.dst.note': 'Desktop, CLI, TUI — all recoloured in one step (light/dark + accent via Rec.709 luma synthesis).',

    'comp.h2': 'Three components, one theme flow.',
    'comp.lede': 'The desktop plugin registers the palettes. The hook syncs them into the Hermes skin file. The generator refreshes them after every Omarchy update.',
    'comp.anatomy': 'None of the three is optional — if you only want the desktop picker, plugin + generator are enough; add the hook if you also want the CLI/TUI synced.',
    'comp.plugin.tag': 'Plugin',
    'comp.plugin.h3': 'Desktop plugin',
    'comp.plugin.body': 'Registers every Omarchy palette in the Hermes picker, as a ⌘K command (<em>Apply Omarchy Theme: &lt;name&gt;</em>) and on a settings card with swatches, filter and apply. Each theme ships a light and a dark palette; the brand accent is shared, the counter-palette is synthesised.',
    'comp.hook.tag': 'Hook',
    'comp.hook.h3': 'Omarchy theme-set hook',
    'comp.hook.body': 'Runs on every <code>omarchy theme set &lt;slug&gt;</code>. Parses <code>colors.toml</code> (user &gt; system &gt; current), writes <code>~/.hermes/skins/&lt;slug&gt;.yaml</code> and activates the skin via <code>hermes skin use</code>. Pure POSIX sh, no Python, always exit 0.',
    'comp.gen.tag': 'Generator',
    'comp.gen.h3': 'Theme-table generator',
    'comp.gen.body': 'Reads <code>colors.toml</code> from <code>/usr/share/omarchy/themes/</code> (with <code>--include-user</code> also from <code>~/.config/omarchy/themes/</code>) and rewrites the <code>// BEGIN GENERATED THEMES … // END GENERATED THEMES</code> block in <code>desktop/plugin.js</code>. <code>HOST=&lt;ssh&gt;</code> reads remotely.',

    'demo.h2': 'Try it.',
    'demo.lede': '29 stock palettes, 5 light + 24 dark. Cycle button or picker — the whole page recolours along, light/dark included. Press <kbd>T</kbd> to cycle through every theme.',
    'demo.sub1': 'Polygon picker — all 29',
    'demo.gridAria': 'Theme selection — all 29 themes',
    'demo.sub2': 'Bento — 12 defaults',
    'demo.bentoAria': 'Theme bento',

    'install.h2': 'Set up in 30 seconds.',
    'install.lede': 'Plugin and hook are two independent paths. The plugin works after a reload, the hook after <code>make install-hook</code>. Both idempotent.',
    'install.plugin.tag': '1. Plugin',
    'install.plugin.meta': 'in ~3 s · via Hermes CLI',
    'install.plugin.note': 'Then reload Hermes Desktop, ⌘K → <em>Reload desktop plugins</em>. Enable once under <em>Settings → Capabilities → Plugins → omarchy-themes</em>.',
    'install.hook.tag': '2. Hook',
    'install.hook.meta': 'idempotent · from the plugin root',
    'install.hook.note': 'Copies <code>hooks/hermes-skin-sync.sh</code> to <code>~/.config/omarchy/hooks/theme-set.d/</code>. Re-run any time (overwrites). Undo with <code>make uninstall</code>.',
    'install.extras': '<strong>Turn auto-sync off:</strong> <code>touch ~/.local/state/omarchy/toggles/skip-hermes-theme-changes</code> — picker and ⌘K keep working, the hook just stops triggering.',

    'foot.readme': 'README →',
    'foot.branch': 'branch: main',
    'foot.ci': 'CI status →',
    'foot.ciMeta': 'lint + tests on push',
    'foot.tagline': 'Omarchy palettes, Hermes-native.',

    'mode.light': 'light',
    'mode.dark': 'dark',
    'bento.more': '+ {n} more in the polygon picker ↑',
    'bento.activate': 'Activate theme {name}',
  },
};

const STORAGE_KEY = 'omarchy-lang';
const listeners = new Set();

function normalize(value) {
  return String(value || '').toLowerCase().startsWith('en') ? 'en' : 'de';
}

function detect() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('lang');
    if (fromQuery) return normalize(fromQuery);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalize(saved);
  } catch (e) { /* localStorage/SearchParams blockiert — Fallback unten */ }
  return normalize(navigator.language);
}

let lang = detect();

export function getLang() {
  return lang;
}

// t('key') -> String; t('key', { n: 3 }) ersetzt {n}.
export function t(key, vars) {
  const table = STRINGS[lang] || STRINGS.de;
  let out = Object.hasOwn(table, key) ? table[key] : (STRINGS.de[key] ?? key);
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      out = out.split(`{${name}}`).join(String(value));
    }
  }
  return out;
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function withLangParam(url, next) {
  const u = new URL(url, window.location.href);
  if (next === 'de') u.searchParams.delete('lang');
  else u.searchParams.set('lang', next);
  return `${u.pathname}${u.search}${u.hash}`;
}

// Statisches DOM uebersetzen: data-i18n (textContent),
// data-i18n-html (innerHTML, eigene Strings), data-i18n-aria-label, data-i18n-title.
export function applyI18n(root = document) {
  document.documentElement.setAttribute('lang', lang);
  document.title = t('meta.title');

  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', t('meta.description'));

  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-html]')) {
    el.innerHTML = t(el.dataset.i18nHtml);
  }
  for (const el of root.querySelectorAll('[data-i18n-aria-label]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.setAttribute('title', t(el.dataset.i18nTitle));
  }
  for (const btn of root.querySelectorAll('[data-lang-btn]')) {
    const active = btn.dataset.langBtn === lang;
    btn.setAttribute('aria-pressed', String(active));
    btn.classList.toggle('is-active', active);
  }
}

export function setLang(next, { persist = true, updateUrl = true } = {}) {
  const resolved = normalize(next);
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, resolved); } catch (e) {}
  }
  if (updateUrl) {
    try { window.history.replaceState(null, '', withLangParam(window.location.href, resolved)); } catch (e) {}
  }
  if (resolved === lang) { applyI18n(); return lang; }
  lang = resolved;
  applyI18n();
  for (const fn of listeners) fn(lang);
  return lang;
}

// Beim Laden: Strings setzen + Switcher verdrahten. Gibt die aktive Sprache zurueck.
export function initI18n(root = document) {
  applyI18n(root);
  for (const btn of root.querySelectorAll('[data-lang-btn]')) {
    btn.addEventListener('click', () => setLang(btn.dataset.langBtn));
  }
  return lang;
}
