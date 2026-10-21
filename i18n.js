// omarchy-themes — i18n fuer die Landing-Page.
//
// Eine Quelle, zwei Sprachen: Deutsch ist die Referenz, Englisch die
// Uebersetzung. Kein Build-Step, kein Netzwerk: die Strings liegen inline, die
// Sprache kommt aus ?lang=, localStorage oder der Browsersprache
// (en* -> en, alles andere -> de).
//
// Key-Deckung pruefen: `node tools/i18n-check.mjs`.

export const LANGS = ['de', 'en'];

export const STRINGS = {
  de: {
    'meta.title': 'omarchy-themes · Hermes-nativ',
    'meta.description': 'Omarchy-Paletten, Hermes-nativ — ein Plugin für Picker und ⌘K in Hermes Desktop; der CLI/TUI-Skin folgt über den Hook. Omarchy setzt das Theme, Hermes Desktop folgt.',
    'a11y.skip': 'Zum Inhalt springen',
    'lang.groupAria': 'Sprache',

    'nav.aria': 'Sektionen',
    'nav.flow': 'Flow',
    'nav.demo': 'Demo',
    'nav.install': 'Install',

    'hero.kicker': 'omarchy · hermes desktop plugin',
    'hero.title': 'Omarchy-Themes, Hermes-nativ.',
    'hero.lede': 'Ein Hermes-Desktop-Plugin, das Omarchy-Themes nach Hermes Desktop synct — inklusive der Themes, die du selbst installiert hast. <code>omarchy theme set nord</code>, und Picker und ⌘K färben sich mit. Der CLI/TUI-Skin folgt, sobald der Hook installiert ist (<code>make install-hook</code>).',
    'hero.cycle': 'Cycle theme →',
    'hero.launcher': 'Themes',
    'status.theme': 'theme',

    'readout.aria': 'Theme-Status',
    'readout.palettes': 'Paletten',
    'readout.skins': 'Skin-Keys',
    'readout.mode': 'Modus',

    'mock.picker.aria': 'Nachbau des Hermes-Settings-Pickers: Theme-Grid mit Swatches und Apply-Button, färbt sich mit der gewählten Palette',
    'mock.picker.caption': 'Einstellungen → Plugins → omarchy-themes',
    'mock.settings': 'Einstellungen',
    'mock.plugins': 'Plugins',
    'mock.filter': 'Filter …',
    'mock.apply': 'Apply',
    'mock.nav.model': 'Modell',
    'mock.nav.chat': 'Chat',
    'mock.nav.display': 'Darstellung',
    'mock.nav.workspace': 'Arbeitsbereich',
    'mock.nav.security': 'Sicherheit',
    'mock.nav.language': 'Sprache',
    'mock.nav.extended': 'Erweitert',
    'mock.nav.billing': 'Abrechnung',
    'mock.nav.gateways': 'Gateways',
    'mock.nav.sessions': 'Sessions',
    'mock.nav.plugins': 'Plugins',

    'mock.about.aria': 'Nachbau des About-Panels: Wechselkette omarchy theme set → Hook → Skin → Oberfläche, mit Live-Zählern für Paletten, Dark und Light',
    'mock.about.caption': 'How switching works (About-Panel)',
    'mock.about.lede': 'Bringt die Omarchy-Themes nach Hermes Desktop — jedes registrierte Theme wird hier wählbar, und der Wechsel färbt die Oberfläche mit.',
    'mock.about.dark': 'dark',
    'mock.about.light': 'light',
    'mock.about.how': 'So wird gewechselt',
    'mock.about.step1': 'schreibt die State-Datei — das Plugin liest sie zuerst.',
    'mock.about.step2': 'Der Hook schreibt',
    'mock.about.step2b': 'und läuft',
    'mock.about.step2c': '.',
    'mock.about.step3': 'Ein',
    'mock.about.step3b': 'ist die letzte Bestätigung — das Plugin legt seine Zwei-Farb-Palette obendrauf.',
    'mock.about.trouble': 'Troubleshooting',
    'mock.about.nosync': 'Auto-Switch aus:',
    'mock.about.log': 'Hook-Log:',

    'arch.h2': 'Sync in eine Richtung: Omarchy → Hermes.',
    'arch.lede': '<code>omarchy theme set</code> schreibt über den Hook ins Hermes-Skin-File und setzt <code>display.skin</code> in der Hermes-Config. Der Desktop-Picker wählt danach nur noch Themes in Hermes aus; er schreibt nichts nach Omarchy zurück.',
    'arch.flowAria': 'Theme-Sync-Flow',
    'arch.cli.tag': 'Omarchy CLI',
    'arch.cli.note': 'Source of Truth für die Theme-Farben ist <code>colors.toml</code> — der Hook liest zuerst <code>current</code> (frisch erzeugt), dann das User-Overlay, dann das System-Theme.',
    'arch.mid.tag': 'omarchy-themes',
    'arch.mid.note': 'Hook schreibt <code>~/.hermes/skins/nord.yaml</code> (22 Keys, hex 3- oder 6-stellig), Plugin registriert die Palette im Picker und ⌘K.',
    'arch.dst.tag': 'Hermes UI',
    'arch.dst.note': 'Hermes Desktop färbt sich mit der Doppel-Palette um; Light/Dark und die synthetisierte Gegenpalette laufen über Rec.709-Luma, der Accent bleibt das Omarchy-Original. Den CLI/TUI-Skin bringt bereits Schritt 2 mit.',

    'demo.h2': 'Probier’s aus.',
    'demo.lede': 'Die Paletten, die das Plugin registriert, Light und Dark gemischt. Cycle-Button oder Launcher — die ganze Seite färbt sich mit, Light/Dark inklusive. Drücke <kbd>T</kbd>, um durch alle Themes zu cyclen.',
    'demo.gridAria': 'Theme-Auswahl — die registrierten Paletten',
    'demo.count': '{n} Paletten',

    'install.h2': 'In 30 Sekunden drin.',
    'install.lede': 'Das Plugin bringt den Desktop-Picker und schaltet ihn bei <code>omarchy theme set</code> automatisch mit.',
    'install.terminal.tag': 'Terminal',
    'install.terminal.meta': 'ein Befehl · ~3 s',
    'install.terminal.note': 'Danach unter <em>Settings → Capabilities → Plugins</em> einmal aktivieren, falls das Plugin nicht bereits aktiv ist.',
    'install.app.tag': 'App',
    'install.app.meta': 'vier Schritte · ohne Terminal',
    'install.app.s1': '<em>Settings → Capabilities → Plugins</em>',
    'install.app.s2': '<em>Von Git installieren</em>',
    'install.app.s3': 'Repository-URL einfügen, <em>Repository prüfen</em>',
    'install.app.s4': '<em>Installieren</em> — die App schaltet das Plugin direkt ein',
    'install.uninstall.tag': 'Deinstallation',
    'install.uninstall.meta': 'ein Befehl · entfernt Plugin und Config-Einträge',
    'install.uninstall.restart': 'Danach Hermes Desktop neu starten — erst dann hört das Plugin auf, seine Themes zu registrieren.',
    'install.uninstall.app': '<strong>Ohne Terminal:</strong> dieselbe Seite → Papierkorb in der Zeile <em>omarchy-themes</em> → <em>Deinstallieren</em>. Die App löscht den Ordner und entlädt das Plugin sofort — ein Neustart ist dafür nicht nötig.',
    'install.uninstall.cleanup': 'Reste, die bleiben dürfen: die Skin-Dateien unter <code>~/.hermes/skins/&lt;slug&gt;.yaml</code>. Hast du den Auto-Sync per Toggle abgeschaltet, liegt zusätzlich <code>~/.local/state/omarchy/toggles/skip-hermes-theme-changes</code> herum — löschen, wenn du ihn nicht mehr brauchst.',
    'install.extras': '<strong>Auto-Sync ausschalten:</strong> <code>touch ~/.local/state/omarchy/toggles/skip-hermes-theme-changes</code> — Picker und ⌘K bleiben funktional.',

    'foot.readme': 'README →',
    'foot.branch': 'branch: main',
    'foot.ci': 'CI status →',
    'foot.ciMeta': 'lint + tests on push',

    'launcher.title': 'Theme wechseln',
    'launcher.placeholder': 'Slug tippen …',
    'launcher.empty': 'Keine Treffer',
    'launcher.count': '{n} von {m}',
    'launcher.hint': '↑↓ wählen · ↵ anwenden · esc schließen',
    'launcher.openAria': 'Theme-Launcher öffnen',
    'tile.aria': 'Theme {name} anwenden',

    'mode.light': 'light',
    'mode.dark': 'dark',
  },

  en: {
    'meta.title': 'omarchy-themes · Hermes-native',
    'meta.description': 'Omarchy colour schemes in Hermes — a plugin for the picker and ⌘K in Hermes Desktop; the CLI/TUI skin follows through the hook. Omarchy sets the theme, Hermes Desktop follows.',
    'a11y.skip': 'Skip to content',
    'lang.groupAria': 'Language',

    'nav.aria': 'Sections',
    'nav.flow': 'Flow',
    'nav.demo': 'Demo',
    'nav.install': 'Install',

    'hero.kicker': 'omarchy · hermes desktop plugin',
    'hero.title': 'Omarchy themes, Hermes-native.',
    'hero.lede': 'A Hermes Desktop plugin that syncs Omarchy themes into Hermes Desktop, including any themes you installed yourself. Run <code>omarchy theme set nord</code> and the picker and ⌘K recolour with it. The CLI/TUI skin follows once the hook is installed (<code>make install-hook</code>).',
    'hero.cycle': 'Cycle theme →',
    'hero.launcher': 'Themes',
    'status.theme': 'theme',

    'readout.aria': 'Theme status',
    'readout.palettes': 'palettes',
    'readout.skins': 'skin keys',
    'readout.mode': 'mode',

    'mock.picker.aria': 'Replica of the Hermes settings picker: theme grid with swatches and apply button, recolours with the selected palette',
    'mock.picker.caption': 'Settings → Plugins → omarchy-themes',
    'mock.settings': 'Settings',
    'mock.plugins': 'Plugins',
    'mock.filter': 'Filter …',
    'mock.apply': 'Apply',
    'mock.nav.model': 'Model',
    'mock.nav.chat': 'Chat',
    'mock.nav.display': 'Appearance',
    'mock.nav.workspace': 'Workspace',
    'mock.nav.security': 'Security',
    'mock.nav.language': 'Language',
    'mock.nav.extended': 'Advanced',
    'mock.nav.billing': 'Billing',
    'mock.nav.gateways': 'Gateways',
    'mock.nav.sessions': 'Sessions',
    'mock.nav.plugins': 'Plugins',

    'mock.about.aria': 'Replica of the about panel: switch chain omarchy theme set → hook → skin → UI, with live counters for palettes, dark and light',
    'mock.about.caption': 'How switching works (about panel)',
    'mock.about.lede': 'Brings the Omarchy themes into Hermes Desktop — every registered theme becomes selectable here, and switching recolours the interface with it.',
    'mock.about.dark': 'dark',
    'mock.about.light': 'light',
    'mock.about.how': 'How switching works',
    'mock.about.step1': 'writes the state file — the plugin reads it first.',
    'mock.about.step2': 'The hook writes',
    'mock.about.step2b': 'and runs',
    'mock.about.step2c': '.',
    'mock.about.step3': 'A',
    'mock.about.step3b': 'event is the final confirmation — the plugin re-applies its dual palette on top.',
    'mock.about.trouble': 'Troubleshooting',
    'mock.about.nosync': 'Turn auto-sync off:',
    'mock.about.log': 'Hook log:',

    'arch.h2': 'One sync, one direction: Omarchy → Hermes.',
    'arch.lede': '<code>omarchy theme set</code> writes into the Hermes skin file through the hook and sets <code>display.skin</code> in the Hermes config. The desktop picker then only selects themes inside Hermes; it writes nothing back to Omarchy.',
    'arch.flowAria': 'Theme sync flow',
    'arch.cli.tag': 'Omarchy CLI',
    'arch.cli.note': 'The source of truth for theme colours is <code>colors.toml</code> — the hook reads <code>current</code> first (freshly generated), then the user overlay, then the system theme.',
    'arch.mid.tag': 'omarchy-themes',
    'arch.mid.note': 'Hook writes <code>~/.hermes/skins/nord.yaml</code> (22 keys, 3- or 6-digit hex); the plugin registers the palette in the picker and ⌘K.',
    'arch.dst.tag': 'Hermes UI',
    'arch.dst.note': 'Hermes Desktop repaints with the dual palette; light/dark and the synthesised counterpart run on Rec.709 luma, the accent stays the native Omarchy one. The CLI/TUI skin already comes from step 2.',

    'demo.h2': 'Try it.',
    'demo.lede': 'The palettes the plugin registers, light and dark mixed. Cycle button or launcher — the whole page recolours along, light/dark included. Press <kbd>T</kbd> to cycle through every theme.',
    'demo.gridAria': 'Theme picker — the registered palettes',
    'demo.count': '{n} palettes',

    'install.h2': 'Set up in 30 seconds.',
    'install.lede': 'The plugin adds the desktop picker and follows <code>omarchy theme set</code> on its own.',
    'install.terminal.tag': 'Terminal',
    'install.terminal.meta': 'one command · ~3 s',
    'install.terminal.note': 'Then enable it once under <em>Settings → Capabilities → Plugins</em> if it is not already active.',
    'install.app.tag': 'App',
    'install.app.meta': 'four steps · no terminal',
    'install.app.s1': '<em>Settings → Capabilities → Plugins</em>',
    'install.app.s2': '<em>Install from Git</em>',
    'install.app.s3': 'paste the repository URL, <em>Review repository</em>',
    'install.app.s4': '<em>Install</em> — the app enables the plugin right away',
    'install.uninstall.tag': 'Uninstall',
    'install.uninstall.meta': 'one command · removes plugin and config entries',
    'install.uninstall.restart': 'Restart Hermes Desktop afterwards — only then does the plugin stop registering its themes.',
    'install.uninstall.app': '<strong>No terminal:</strong> same page → trash icon on the <em>omarchy-themes</em> row → <em>Uninstall</em>. The app deletes the folder and unloads the plugin immediately — no restart needed.',
    'install.uninstall.cleanup': 'Leftovers you may keep: the skin files under <code>~/.hermes/skins/&lt;slug&gt;.yaml</code>. If you turned auto-sync off with the toggle, <code>~/.local/state/omarchy/toggles/skip-hermes-theme-changes</code> stays behind too — delete it once you no longer need it.',
    'install.extras': '<strong>Turn auto-sync off:</strong> <code>touch ~/.local/state/omarchy/toggles/skip-hermes-theme-changes</code> — picker and ⌘K keep working.',

    'foot.readme': 'README →',
    'foot.branch': 'branch: main',
    'foot.ci': 'CI status →',
    'foot.ciMeta': 'lint + tests on push',

    'launcher.title': 'Switch theme',
    'launcher.placeholder': 'Type a slug …',
    'launcher.empty': 'No matches',
    'launcher.count': '{n} of {m}',
    'launcher.hint': '↑↓ select · ↵ apply · esc close',
    'launcher.openAria': 'Open theme launcher',
    'tile.aria': 'Apply theme {name}',

    'mode.light': 'light',
    'mode.dark': 'dark',
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

// Statisches DOM uebersetzen: data-i18n (textContent), data-i18n-html
// (innerHTML, eigene Strings), data-i18n-aria-label, data-i18n-title,
// data-i18n-alt und data-i18n-placeholder.
export function applyI18n(root = document) {
  document.documentElement.setAttribute('lang', lang);
  document.title = t('meta.title');

  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', t('meta.description'));

  // Social-Preview folgt der Sprache: og:title/og:description sind die
  // statischen DE-Fallbacks im <head>, hier werden sie mit uebersetzt.
  for (const [prop, value] of [['og:title', t('meta.title')], ['og:description', t('meta.description')]]) {
    const meta = document.querySelector(`meta[property="${prop}"]`);
    if (meta) meta.setAttribute('content', value);
  }

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
  for (const el of root.querySelectorAll('[data-i18n-alt]')) {
    el.setAttribute('alt', t(el.dataset.i18nAlt));
  }
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) {
    el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
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
