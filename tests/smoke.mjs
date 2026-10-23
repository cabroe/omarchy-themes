// Smoke test: load plugin.js in plain Node with stubbed SDK modules,
// run register(ctx) against a fake context and validate every theme.
//
//   node tests/smoke.mjs
import * as nodeModule from 'node:module'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { resolve } from './stubs/loader.mjs'

// registerHooks (Node ≥ 22.15) is in-thread and not deprecated; fall back for older Node.
if (nodeModule.registerHooks) nodeModule.registerHooks({ resolve })
else nodeModule.register('./stubs/loader.mjs', import.meta.url)

const pluginMod = await import('../desktop/plugin.js')
const { default: plugin } = pluginMod

const contributions = []
const settingsPages = []
const disposers = []
const eventListeners = []
const ctx = {
  register: c => { contributions.push(c); return () => {} },
  registerSettingsPage: p => settingsPages.push(p),
  onDispose: fn => disposers.push(fn),
  onEvent: (type, listener) => { eventListeners.push({ type, listener }); return () => {} },
  os: { writeClipboard: () => true },
}

assert.equal(plugin.id, 'omarchy-themes')
plugin.register(ctx)

const themes = contributions.filter(c => c.area === 'themes')
const palette = contributions.filter(c => c.area === 'palette')
const HEX = /^#[0-9a-f]{6}$/

// Built-in RAW-Einträge (desktop/plugin.js) speisen die generierten Skins genauso
// wie die Plugin-Themes, tauchen aber nie in `contributions` auf — deshalb hat sie
// bisher niemand geprüft (QA-Befund t_1048777b). Der Guard parst den RAW-Block
// strukturell, weil die Konstante nicht exportiert ist; eine reine Literal-Zählung
// reichte nicht: #-lose Werte ("89b4fa"), benannte Farben ("tomato") und ein
// gelöschter Palette-Eintrag liefen damit grün durch (QA-Befund t_5bcdae46).
// Bewusste Änderung der Palette-/Schlüsselzahl: die Konstanten hier mitziehen —
// genau das ist der Wächter gegen stillen Verlust.
{
  const EXPECTED_PALETTES = 22
  const EXPECTED_KEYS = 23 // 1× mode + 22 Farben je Palette
  const src = await readFile(new URL('../desktop/plugin.js', import.meta.url), 'utf8')
  const start = src.indexOf('const RAW = [')
  assert.ok(start !== -1, 'desktop/plugin.js: `const RAW = [` not found')
  const end = src.indexOf('\n]', start)
  assert.ok(end !== -1, 'desktop/plugin.js: RAW block not terminated')
  const entries = [...src.slice(start, end).matchAll(/\{ slug:"([^"]+)"\s*,\s*c:\{([^}]*)\}\s*\}/g)]
    .map(m => ({ slug: m[1], body: m[2] }))
  assert.equal(entries.length, EXPECTED_PALETTES,
    `RAW: ${entries.length} Paletten gefunden, erwartet ${EXPECTED_PALETTES} (Palette entfernt oder Parser-Drift?)`)
  for (const { slug, body } of entries) {
    const pairs = [...body.matchAll(/(\w+)\s*:\s*"([^"]*)"/g)].map(m => [m[1], m[2]])
    assert.equal(pairs.length, EXPECTED_KEYS, `RAW ${slug}: ${pairs.length} Schlüssel, erwartet ${EXPECTED_KEYS}`)
    for (const [key, value] of pairs) {
      if (key === 'mode') {
        assert.match(value, /^(dark|light)$/, `RAW ${slug}.mode = "${value}"`)
        continue
      }
      assert.match(value, HEX, `RAW ${slug}.${key} = "${value}" (not #rrggbb)`)
    }
  }
}

assert.ok(themes.length >= 1, 'no themes registered')
// One ⌘K row per theme; the host lists a row only with `label` + `run`
// (apps/desktop/src/app/command-palette/contrib.ts usePaletteContributions).
assert.equal(palette.length, themes.length)
for (const { data: row } of palette) {
  assert.ok(row.label, `${row.id}: palette row without label`)
  assert.equal(typeof row.run, 'function', `${row.id}: palette row without run() is hidden by the host`)
}
// Desktop names are prefixed: Hermes registers CLI skins under the bare slug as
// backend themes, which would shadow a same-named plugin theme (resolveTheme).
for (const { data: t } of themes) assert.match(t.name, /^omarchy-/, `${t.name}: missing omarchy- prefix`)
assert.equal(settingsPages.length, 1)

// Hermes mounts every settings page and sub-page as a component
// (ContribRender: createElement(render)); a throw there kills the page.
// Resolve function components recursively so jsx misuse surfaces here.
const renderTree = node => {
  if (Array.isArray(node)) return node.forEach(renderTree)
  if (!node || typeof node !== 'object') return
  if (typeof node.type === 'function') return renderTree(node.type(node.props))
  renderTree(node.props?.children)
}
for (const page of settingsPages) {
  for (const node of [page, ...(page.children ?? [])]) {
    assert.equal(typeof node.render, 'function', `settings ${node.id}: render missing`)
    renderTree(node.render({}))
  }
}
assert.equal(disposers.length, 1)

const names = new Set()
for (const { data: t } of themes) {
  assert.ok(!names.has(t.name), `duplicate theme name ${t.name}`)
  names.add(t.name)
  for (const group of ['colors', 'terminal', 'darkColors', 'darkTerminal']) {
    for (const [k, v] of Object.entries(t[group] ?? {})) {
      assert.match(v, HEX, `${t.name}.${group}.${k} = ${v}`)
    }
  }
  assert.ok(t.colors.background && t.colors.foreground && t.colors.accent)

  // Every theme must ship BOTH light + dark palettes and BOTH terminal
  // palettes — otherwise a dark Omarchy theme activated in a light UI paints
  // only the border (renderer falls back to the existing light default).
  assert.ok(t.darkColors?.background, `${t.name}: missing darkColors`)
  assert.ok(t.darkTerminal?.foreground, `${t.name}: missing darkTerminal`)
  assert.notDeepStrictEqual(t.colors, t.darkColors,
    `${t.name}: colors === darkColors (no synthesis happened)`)

  // Cards, sidebar and borders must separate from the page colour in both
  // palettes, also for themes Omarchy ships without surface shades (aetheria,
  // ayaka, cpunk, last-horizon, solitude) or with dark_background == background
  // (hermarchy, omacarchy).
  for (const [name, p] of [['light', t.colors], ['dark', t.darkColors]]) {
    for (const key of ['card', 'border', 'sidebarBackground']) {
      assert.notEqual(p[key], p.background, `${t.name}: ${name} ${key} is flat`)
    }
  }

  // Typography: the renderer's applyTheme falls back to DEFAULT_TYPOGRAPHY
  // when fontSans/fontMono are missing, so an empty stack lets the OS pick
  // a font that often clashes with the chrome.
  assert.ok(t.typography?.fontSans?.length > 0, `${t.name}: missing fontSans`)
  assert.ok(t.typography?.fontMono?.length > 0, `${t.name}: missing fontMono`)
}

// Hermes built-in collisions are SKIPPED (not renamed) — Hermes Desktop is
// Source of Truth. The plugin only registers unique Omarchy themes.
// Assertion: catppuccin is NOT in names (skipped), never shadowed.
assert.ok(!names.has('catppuccin'), 'catppuccin should be skipped (Hermes is Source of Truth)')

// Plugin subscribes to gateway skin.changed for CLI→Desktop sync.
const skinListener = eventListeners.find(e => e.type === 'skin.changed')
assert.ok(skinListener, 'plugin must subscribe to skin.changed')

// ---------------------------------------------------------------------------
// Mode sync from outside React (⌘K row + skin.changed). Mirrors the host's
// modePref.assign: only the live profile's slot + the global slot change, and
// the ThemeProvider is poked via a `storage` event on MODE_KEY.
// ---------------------------------------------------------------------------
const { requested } = await import('@hermes/plugin-sdk')
const store = new Map()
const storageEvents = []
globalThis.StorageEvent ??= class StorageEvent { constructor(type, init) { Object.assign(this, init, { type }) } }
globalThis.window = {
  localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) },
  dispatchEvent: e => storageEvents.push(e),
}
const MODE_KEY = 'hermes-desktop-mode-v1'
const PROFILE_MODES_KEY = 'hermes-desktop-profile-modes-v1'
const LAST_PROFILE_KEY = 'hermes-desktop-active-profile-v1'
const runRow = slug => palette.find(p => p.data.id === `omarchy-themes.apply.${slug}`).data.run()
// The listener re-applies on the next tick (after the host's own handling).
const skinChanged = async name => {
  skinListener.listener({ type: 'skin.changed', payload: { name } })
  await new Promise(r => setTimeout(r, 0))
}

// Named live profile: its own slot + global change, other profiles keep theirs.
store.set(LAST_PROFILE_KEY, 'work')
store.set(PROFILE_MODES_KEY, JSON.stringify({ home: 'light', work: 'light' }))
store.set(MODE_KEY, 'light')
runRow('nord')
assert.deepEqual(JSON.parse(store.get(PROFILE_MODES_KEY)), { home: 'light', work: 'dark' })
assert.equal(store.get(MODE_KEY), 'dark')
assert.equal(storageEvents.at(-1)?.key, MODE_KEY, 'ThemeProvider must be poked via a storage event')
assert.equal(requested.at(-1), 'omarchy-nord')

// Default profile owns the global slot only; the per-profile record is left alone.
store.delete(LAST_PROFILE_KEY)
// The host requests the bare-slug backend skin right after the plugins; the
// deferred apply must come last so the dual-palette theme is what stays.
skinListener.listener({ type: 'skin.changed', payload: { name: 'lupine' } })
const syncRequested = requested.length
requested.push('lupine') // what the host's ingestBackendSkin → ThemeProvider does
await new Promise(r => setTimeout(r, 0))
assert.ok(requested.length > syncRequested + 1, 'listener must re-apply after the host')
assert.equal(requested.at(-1), 'omarchy-lupine')
assert.equal(store.get(MODE_KEY), 'light')
assert.deepEqual(JSON.parse(store.get(PROFILE_MODES_KEY)), { home: 'light', work: 'dark' })

// Built-in collision: Hermes' own catppuccin, in Omarchy's catppuccin mode (dark).
await skinChanged('catppuccin')
assert.equal(store.get(MODE_KEY), 'dark')
assert.equal(requested.at(-1), 'catppuccin')
const requestedBefore = requested.length

// Foreign skins (non-Omarchy built-in, unknown name) leave the mode untouched.
store.set(MODE_KEY, 'system')
const eventsBefore = storageEvents.length
await skinChanged('github')
await skinChanged('no-such-skin')
assert.equal(store.get(MODE_KEY), 'system')
assert.equal(storageEvents.length, eventsBefore)
assert.equal(requested.length, requestedBefore)

// ---------------------------------------------------------------------------
// Defensive requestMode — the plugin probes @hermes/plugin-sdk at module
// load. Today's SDK does not export requestMode (defined internally in
// apps/desktop/src/themes/request.ts, not re-exported from sdk/index.ts), so
// the local mirror handles the change: write to PROFILE_MODES_KEY + MODE_KEY,
// then dispatch a StorageEvent so the ThemeProvider repaints. The mirror
// must also be idempotent — two consecutive calls with the same effective
// (profile, mode) target must fire exactly one event, not two (no flackern
// from a double-click on Apply, a fast CLI/host race, or a re-emit).
// ---------------------------------------------------------------------------

// Sanity: today's SDK stub does not export requestMode, so the local mirror
// is the active path. A future SDK that re-exports it takes precedence
// (probed at module load into SDK_REQUEST_MODE).
const sdkNs = await import('@hermes/plugin-sdk')
assert.equal(sdkNs.requestMode, undefined,
  "today's SDK does not export requestMode — the plugin's local mirror is the fallback path")

// Reset to a clean baseline: work profile, work:light, mode:light. The
// earlier mode-sync tests left state in any flavour; this block needs to
// know exactly what the local mirror sees.
store.set(LAST_PROFILE_KEY, 'work')
store.set(PROFILE_MODES_KEY, JSON.stringify({ home: 'light', work: 'light' }))
store.set(MODE_KEY, 'light')

// Storage already has the target mode → the mirror's idempotency guard
// (source of truth = storage, not the in-memory lastRequest cache) skips
// the redundant write + StorageEvent. A fresh process / hot reload /
// cross-tab scenario where storage was changed externally does not get a
// re-dispatched event that would re-paint flicker.
const evBaseline = storageEvents.length
runRow('lupine')                              // light, work → storage already 'light' → no-op
assert.equal(storageEvents.length, evBaseline,
  'storage already has target mode → no-op (storage is source of truth)')

// Same (profile, mode) → idempotent no-op, no extra event.
const evAfterRepeat = storageEvents.length
runRow('lupine')                              // same → no-op
assert.equal(storageEvents.length, evAfterRepeat,
  'same-mode repeat must be a no-op (no flackern)')

// Flip storage so the next call observes a real state change.
store.set(MODE_KEY, 'system')
store.set(PROFILE_MODES_KEY, JSON.stringify({ home: 'light', work: 'system' }))

// A real change (mode flip) → fires exactly one event. Next identical
// call → idempotent no-op.
const evAfterLupine = storageEvents.length
runRow('nord')                                // dark, work → mode flips system → dark → one event
assert.equal(storageEvents.length, evAfterLupine + 1,
  'mode change fires exactly one event')

const evAfterNord = storageEvents.length
runRow('nord')                                // same → no-op
assert.equal(storageEvents.length, evAfterNord,
  'same-mode repeat after a change must also be idempotent')

// Restore for the file-watching tests below (they expect default profile,
// MODE_KEY='dark', PROFILE_MODES_KEY={home:light, work:dark}).
store.delete(LAST_PROFILE_KEY)
store.set(PROFILE_MODES_KEY, JSON.stringify({ home: 'light', work: 'dark' }))
store.set(MODE_KEY, 'dark')

// ---------------------------------------------------------------------------
// Local file doors, independent of which gateway the desktop is connected to:
//   1. Omarchy's current/theme.name (written ~0.5 s into `omarchy theme set`)
//   2. display.skin in <HERMES_HOME>/config.yaml (written ~2-3 s later by the hook)
// Both drive the same apply path; the later one for the same name is a no-op.
// ---------------------------------------------------------------------------
let clock = 1e12
const realNow = Date.now
Date.now = () => clock
const files = new Map()
const changeListeners = new Set()
const watchPaths = new Map()
let nextWatch = 0
const delays = new Map() // per-path artificial latency for race tests
window.hermesDesktop = {
  desktopPluginsRoot: async () => '/home/u/.hermes/desktop-plugins',
  getMachineProfile: async () => ({ username: 'u' }),
  watchPreviewFile: async p => { const id = `w${++nextWatch}`; watchPaths.set(id, p); return { id, path: p } },
  readFileText: async p => { if (delays.has(p)) await new Promise(r => setTimeout(r, delays.get(p))); return files.has(p) ? { text: files.get(p) } : { error: 'ENOENT' } },
  stopPreviewFileWatch: async id => watchPaths.delete(id),
  onPreviewFileChanged: fn => { changeListeners.add(fn); return () => changeListeners.delete(fn) },
}
const CONFIG = '/home/u/.hermes/config.yaml'
const THEME_NAME = '/home/u/.local/state/omarchy/current/theme.name'
const config = skin => `model:\n  skin: not-this\ndisplay:\n  bell_on_complete: false\n  nested:\n    skin: nor-this\n  skin: "${skin}"  # active\nother: 1\n`
const tick = () => new Promise(r => setTimeout(r, 0))
const settle = async () => { await tick(); await tick(); await tick() }
const changed = async path => {
  for (const [id, p] of watchPaths) if (p === path) for (const fn of changeListeners) fn({ id, path })
  await settle()
}
const setSkin = (skin, theme = skin) => { files.set(CONFIG, config(skin)); files.set(THEME_NAME, theme + '\n') }
const isolated = (extra = {}) => ({ ...ctx, ...extra, register: () => () => {}, registerSettingsPage: () => {} })
setSkin('nord')
const localDisposers = []
plugin.register(isolated({ onDispose: fn => localDisposers.push(fn) }))
await settle()
assert.deepEqual([...watchPaths.values()].sort(), [CONFIG, THEME_NAME, '/home/u/.local/state/omarchy/current/theme/colors.toml'].sort(),
  'plugin must watch Omarchy theme.name, colors.toml and the local config.yaml')

// Launch: the current theme is only the baseline, nothing is applied.
const beforeLocal = requested.length
store.set(MODE_KEY, 'light')
await changed(THEME_NAME)
await changed(CONFIG)
assert.equal(requested.length, beforeLocal, 'unchanged theme must not re-apply')

// `omarchy theme set lupine`: theme.name flips first → light + lupine at once.
files.set(THEME_NAME, 'lupine\n')
store.set(MODE_KEY, 'dark')
await changed(THEME_NAME)
assert.equal(requested.at(-1), 'omarchy-lupine')
assert.equal(store.get(MODE_KEY), 'light')

// ~2.5 s later the hook's `hermes skin use` flips display.skin: same name → no-op.
const afterFast = requested.length
clock += 2500
files.set(CONFIG, config('lupine'))
await changed(CONFIG)
assert.equal(requested.length, afterFast, 'the slower door must not re-apply the same theme')

// After the dedupe window the same name applies again; "Tokyo Night" is a slug.
clock += 20000
files.set(THEME_NAME, 'Tokyo Night\n')
await changed(THEME_NAME)
assert.equal(requested.at(-1), 'omarchy-tokyo-night')
assert.equal(store.get(MODE_KEY), 'dark')

// A manual `hermes skin use` (config only) still syncs.
clock += 20000
files.set(CONFIG, config('white'))
await changed(CONFIG)
assert.equal(requested.at(-1), 'omarchy-white')
assert.equal(store.get(MODE_KEY), 'light')

// Unknown themes and other preview watches' events are ignored.
const beforeIgnored = requested.length
clock += 20000
files.set(THEME_NAME, 'no-such-theme\n')
await changed(THEME_NAME)
for (const fn of changeListeners) fn({ id: 'someone-else', path: THEME_NAME })
await settle()
assert.equal(requested.length, beforeIgnored)

// The host's own skin.changed handling comes right after the plugins: the
// forced event re-apply must win even inside the dedupe window.
clock += 20000
files.set(THEME_NAME, 'nord\n')
await changed(THEME_NAME)
const beforeForce = requested.length
await skinChanged('nord')
assert.ok(requested.length > beforeForce, 'skin.changed must re-apply even inside the dedupe window')

// Dispose releases both watches.
localDisposers.forEach(d => d())
assert.equal(watchPaths.size, 0, 'dispose must stop the file watches')
assert.equal(changeListeners.size, 0)

// Launch catch-up: the plugin remembers what it last saw. Omarchy switched
// while Hermes was closed → the stored value differs → apply once at launch.
// Same value → only the baseline, the user's desktop pick stays.
const pluginStore = new Map()
const storage = { get: (k, d) => pluginStore.get(k) ?? d, set: (k, v) => pluginStore.set(k, v), remove: k => pluginStore.delete(k) }
const launch = async skin => {
  clock += 20000
  setSkin(skin)
  const before = requested.length
  const ds = []
  plugin.register(isolated({ storage, onDispose: fn => ds.push(fn) }))
  await settle()
  ds.forEach(d => d())
  return requested.length - before
}
assert.equal(await launch('nord'), 0, 'first launch only seeds the baseline')
assert.equal(await launch('nord'), 0, 'unchanged theme must not stomp the desktop pick')
assert.equal(await launch('lupine'), 1, 'theme changed while closed → catch up once (both doors agree)')
assert.equal(requested.at(-1), 'omarchy-lupine')
assert.equal(pluginStore.get('last-theme'), 'lupine')
assert.equal(pluginStore.get('last-skin'), 'lupine')
assert.equal(await launch('lupine'), 0, 'caught up once, not on every launch')

// Omarchy themes the baked table does not know (user overlay, newer Omarchy):
// the palette comes from current/theme/colors.toml, as ONE replaceable theme.
const COLORS = '/home/u/.local/state/omarchy/current/theme/colors.toml'
const TOGGLE = '/home/u/.local/state/omarchy/toggles/skip-hermes-theme-changes'
const toml = (bg, fg) => `accent = "#BE3F50"\nselection = "#abcdef"\nforeground = "${fg}"\nbackground = "${bg}"\n\ncolor1 = "#c8e967"\ncolor2 = "#E20342"\ncolor8 = "#c53253"\n`
const registered = new Map()
const dynDisposers = []
const regLog = []
let ctxSeq = 0
const dynCtx = (storage) => {
  const id = ++ctxSeq
  return {
    ...ctx,
    storage,
    register: c => { regLog.push([id, c.id]); registered.set(c.id, c.data); return () => { if (registered.get(c.id) === c.data) registered.delete(c.id) } },
    registerSettingsPage: () => {},
    onEvent: (type, listener) => { dynListeners.push({ type, listener }); return () => {} },
    onDispose: fn => dynDisposers.push(fn),
    __id: id,
  }
}
const dynListeners = []
const fireSkin = async name => {
  dynListeners.filter(e => e.type === 'skin.changed').forEach(e => e.listener({ type: 'skin.changed', payload: { name } }))
  await new Promise(r => setTimeout(r, 0))
}
const disposeDyn = () => dynDisposers.splice(0).forEach(d => d())

clock += 20000
files.set(COLORS, toml('#0e091d', '#14b9b5'))
files.set(THEME_NAME, 'nord\n')
plugin.register(dynCtx())
await settle()
assert.ok(!registered.has('theme-current'), 'a known theme needs no dynamic theme')

clock += 20000
files.set(THEME_NAME, 'my-custom\n')
await changed(THEME_NAME)
let dyn = registered.get('theme-current')
assert.ok(dyn, 'unknown Omarchy theme must be registered from colors.toml')
assert.equal(dyn.name, 'omarchy-current')
assert.equal(dyn.label, 'Omarchy My Custom')
assert.equal(dyn.darkColors.background, '#0e091d')
assert.equal(dyn.darkTerminal.selectionBackground, '#abcdef', 'selection maps from the official colors.toml key')
assert.equal(requested.at(-1), 'omarchy-current')
assert.equal(store.get(MODE_KEY), 'dark')

// The next unknown theme replaces the registration; the mode follows the background.
clock += 20000
files.set(COLORS, toml('#fafafa', '#212121'))
files.set(THEME_NAME, 'my-light\n')
await changed(THEME_NAME)
dyn = registered.get('theme-current')
assert.equal(dyn.label, 'Omarchy My Light')
assert.equal(dyn.colors.background, '#fafafa')
assert.equal(requested.at(-1), 'omarchy-current')
assert.equal(store.get(MODE_KEY), 'light')

// colors.toml missing → nothing is applied, the user's appearance stays.
const beforeMissing = requested.length
clock += 20000
files.delete(COLORS)
files.set(THEME_NAME, 'no-colors\n')
await changed(THEME_NAME)
assert.equal(requested.length, beforeMissing)

// Omarchy's own `omarchy` skin stands for the current Omarchy theme: the
// host's single-palette paint is replaced by the dual-palette entry. The host
// requests the skin itself right after the plugins — the alias must win after it.
clock += 20000
files.set(COLORS, toml('#0e091d', '#14b9b5'))
files.set(THEME_NAME, 'my-custom\n')
await changed(THEME_NAME)
const hostRequested = requested.length
requested.push('omarchy') // what the host's ingestBackendSkin → ThemeProvider does
await fireSkin('omarchy')
assert.ok(requested.length > hostRequested + 1, 'the omarchy alias must re-apply after the host')
assert.equal(requested.at(-1), 'omarchy-current')

// An unknown theme named like a Hermes built-in never becomes a dynamic theme.
const beforeBuiltin = requested.length
clock += 20000
files.set(THEME_NAME, 'solarized\n')
await changed(THEME_NAME)
await fireSkin('solarized')
assert.equal(requested.length, beforeBuiltin, 'built-in names stay Hermes’ own')

// The palette changed under the SAME unknown slug (edited custom theme,
// `omarchy theme set` re-run): the colors.toml door re-registers and repaints.
clock += 20000
files.set(THEME_NAME, 'my-custom\n')
await changed(THEME_NAME)
const beforeEdit = requested.length
files.set(COLORS, toml('#123456', '#abcdef'))
await changed(COLORS)
await new Promise(r => setTimeout(r, 400)) // door 4 debounces 250 ms (real timer)
await settle()
assert.equal(registered.get('theme-current').darkColors.background, '#123456', 'edited palette is re-read')
assert.equal(requested.at(-1), 'omarchy-current', 'edited palette is repainted')
assert.ok(requested.length > beforeEdit)

// Same-slug edit, but the colors.toml watch is already dead (Omarchy swaps
// current/theme by rename): Omarchy's republished `omarchy` skin is the
// fallback signal — the listener re-reads the palette and repaints after the
// host's own single-palette paint.
clock += 20000
files.set(COLORS, toml('#0f2a1e', '#e8f0e8'))
const hostReq2 = requested.length
requested.push('omarchy') // what the host's ingestBackendSkin does with the republished skin
await fireSkin('omarchy')
assert.ok(requested.length > hostReq2 + 1, 'the republished omarchy skin must re-apply after the host')
assert.equal(registered.get('theme-current').darkColors.background, '#0f2a1e', 'republished skin re-reads the palette')
assert.equal(requested.at(-1), 'omarchy-current')

// Toggle skip-hermes-theme-changes stops every automatic switch — the watcher
// and the gateway event alike.
const beforeToggle = requested.length
files.set(TOGGLE, '')
clock += 20000
files.set(THEME_NAME, 'tokyo-night\n')
await changed(THEME_NAME)          // refreshSkip ran here → the cache is fresh
await fireSkin('tokyo-night')      // this listener decides on the cached toggle
assert.equal(requested.length, beforeToggle, 'toggle on: no automatic switching')

// Launch under the toggle restores the palette shown before, not Omarchy's
// current one (my-custom #0f2a1e was shown; Omarchy moved on to my-light).
disposeDyn()
const persistent = new Map()
const pstore = { get: (k, d) => persistent.get(k) ?? d, set: (k, v) => persistent.set(k, v) }
// An instance WITH storage sees my-custom/#0f2a1e once (toggle off), so the
// palette is persisted.
files.delete(TOGGLE)
files.set(THEME_NAME, 'my-custom\n')
plugin.register(dynCtx(pstore))
await settle()
await changed(THEME_NAME)
disposeDyn()
files.set(TOGGLE, '')
files.set(COLORS, toml('#fafafa', '#212121'))
files.set(THEME_NAME, 'my-light\n')
const beforeSkipLaunch = requested.length
plugin.register(dynCtx(pstore))
await settle()
assert.equal(registered.get('theme-current').darkColors.background, '#0f2a1e', 'skip launch restores the palette shown before')
assert.equal(requested.length, beforeSkipLaunch, 'skip launch must not switch the theme')
disposeDyn()
files.delete(TOGGLE)
clock += 20000
plugin.register(dynCtx())
await settle()
files.set(THEME_NAME, 'nord\n')
await changed(THEME_NAME)
assert.equal(requested.at(-1), 'omarchy-nord', 'toggle off: switching resumes')
disposeDyn()

// A disposed instance must not register into the next one while its file
// reads are still in flight (register/dispose/register).
regLog.length = 0
delays.set(COLORS, 80)
files.set(COLORS, toml('#0e091d', '#14b9b5'))
files.set(THEME_NAME, 'my-custom\n')
const instA = dynCtx()
plugin.register(instA)
await tick()                    // primeCurrent is now awaiting the delayed read
disposeDyn()
const instB = dynCtx()
plugin.register(instB)
await new Promise(r => setTimeout(r, 200))
await settle()
const stale = regLog.filter(([i, id]) => id === 'theme-current' && i === instA.__id).length
assert.equal(stale, 0, 'a disposed instance must not register theme-current')
assert.ok(regLog.some(([i, id]) => id === 'theme-current' && i === instB.__id), 'the live instance registers theme-current')
delays.delete(COLORS)
disposeDyn()

// Launch: the dynamic palette is registered again (it is not persisted), but
// registering is no theme switch.
disposeDyn()
assert.ok(!registered.has('theme-current'), 'dispose must unregister the dynamic theme')
files.set(COLORS, toml('#0e091d', '#14b9b5'))
files.set(THEME_NAME, 'my-custom\n')
const beforePrime = requested.length
plugin.register(dynCtx())
await settle()
assert.ok(registered.has('theme-current'), 'launch must re-register the current unknown theme')
assert.equal(requested.length, beforePrime, 'launch registration must not switch the theme')
disposeDyn()

// ---------------------------------------------------------------------------
// Multi-instance dedupe — `lastApplied` must be per-instance. A disposed
// instance's dedupe state must not leak into the next one, otherwise a fresh
// instance applying the SAME theme inside the previous instance's dedupe
// window is wrongly silenced.
// ---------------------------------------------------------------------------
// `watchFile` only fires onValue when the read value differs from what it
// last saw. Without plugin storage, the initial read seeds `last` but does
// not call onValue (launch catch-up is opt-in). To drive applySkin through a
// non-forced path we flip THEME_NAME from a starter value to 'lupine'.
clock += 20000  // clear any leftover window from earlier tests
files.set(THEME_NAME, 'starter-a\n')
files.set(CONFIG, config('starter-a'))
files.set(COLORS, toml('#0e091d', '#14b9b5'))  // safe bogus palette — dynamic theme not used here
const lastAppliedA = dynCtx()
plugin.register(lastAppliedA)
await settle()                                  // last seen = 'starter-a', no onValue
files.set(THEME_NAME, 'lupine\n')
await changed(THEME_NAME)                       // flip → onValue('lupine') → applySkin('lupine')
assert.equal(requested.at(-1), 'omarchy-lupine', 'instance A applies lupine')
const appliedByA = requested.length
disposeDyn()
clock += 0  // INSIDE A's dedupe window — the bug would bite here
files.set(THEME_NAME, 'starter-b\n')            // B's initial read lands on a different value
const lastAppliedB = dynCtx()
plugin.register(lastAppliedB)
await settle()                                  // last seen = 'starter-b', no onValue
files.set(THEME_NAME, 'lupine\n')                // FLIP → onValue('lupine') → applySkin('lupine')
const appliedByBFromBaseline = requested.length
await changed(THEME_NAME)
assert.ok(requested.length > appliedByBFromBaseline,
  "a fresh instance must apply the same theme inside the previous instance's dedupe window")
assert.equal(requested.at(-1), 'omarchy-lupine', 'instance B applies lupine even though A just did')
// Same instance, repeated calls for the same name — internal dedupe still works.
files.delete(COLORS)                            // starter-c is unknown — without a palette, registerCurrent is a no-op and applySkin returns early
files.set(THEME_NAME, 'starter-c\n')
await changed(THEME_NAME)                       // different name first, resets the dedupe slot
const beforeBRepeat = requested.length
clock += 0  // still inside the window
files.set(THEME_NAME, 'lupine\n')
await changed(THEME_NAME)                       // same name → B's own dedupe must drop it
assert.equal(requested.length, beforeBRepeat,
  "instance B's own dedupe window is still active for the same name")
disposeDyn()
files.delete(COLORS)

// ---------------------------------------------------------------------------
// Terminal-Skin hook: the settings button writes the embedded script to the
// Omarchy hook dir via the desktop bridge (the renderer has no fs).
// ---------------------------------------------------------------------------
{
  const writes = []
  const prevBridge = window.hermesDesktop
  window.hermesDesktop = {
    desktopPluginsRoot: async () => '/home/u/.hermes/desktop-plugins',
    readFileText: async () => ({ error: 'ENOENT' }),
    writeTextFile: async (path, content) => { writes.push([path, content]); return { path } },
    trashPath: async path => { writes.push(['trash', path]) },
  }
  const hookCtx = { ...ctx, os: { notify: () => {}, writeClipboard: () => true }, setTimeout: fn => fn() }
  const findButton = node => {
    if (Array.isArray(node)) {
      for (const n of node) { const hit = findButton(n); if (hit) return hit }
      return null
    }
    if (!node || typeof node !== 'object') return null
    if (node.props?.children === 'Installieren') return node
    if (typeof node.type === 'function') return findButton(node.type(node.props))
    return findButton(node.props?.children)
  }
  // The host renders a settings page's components with their props object, and
  // HookSection's props are `{ ctx }` (BrowsePage: jsx(HookSection, { ctx })).
  const btn = findButton(pluginMod.HookSection({ ctx: hookCtx }))
  assert.ok(btn, 'HookSection renders an Installieren button')
  btn.props.onClick()
  await settle()
  assert.equal(writes.length, 1, 'install writes exactly one file')
  assert.equal(writes[0][0], '/home/u/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh', 'hook target path')
  assert.ok(writes[0][1].startsWith('#!/bin/sh'), 'embedded hook script is written')
  window.hermesDesktop = prevBridge
}

// ---------------------------------------------------------------------------
// Shared helpers for the two P1 regression blocks below. The SDK stubs render
// nothing (Button returns null), so a HookSection tree is plain elements, and
// the Installieren button is the element whose single child is that label.
// ---------------------------------------------------------------------------
const hookTarget = '/home/u/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh'
const findInstaller = node => {
  if (Array.isArray(node)) {
    for (const n of node) { const hit = findInstaller(n); if (hit) return hit }
    return null
  }
  if (!node || typeof node !== 'object') return null
  if (node.props?.children === 'Installieren') return node
  if (typeof node.type === 'function') return findInstaller(node.type(node.props))
  return findInstaller(node.props?.children)
}

// ---------------------------------------------------------------------------
// A1-1 (P1) — the hook status is read on EVERY mount. `hookChecked` used to be
// a MODULE-level flag: the first mount of the process read the file, every
// later mount skipped the read and rendered the initial `installed: false`, so
// a re-opened settings page claimed "nicht installiert" over a hook that really
// existed — and its Install button then overwrote that hook. The latch must be
// per component instance (a re-render keeps it, an unmount drops it).
//
// Evidence = the bridge's readFileText counter (the contract this task names):
// one read per mount, a fresh read on every remount, and never a second read
// inside the same mount. The rendered status line cannot be asserted here: the
// SDK stub's useState setter is a no-op and a tree is a snapshot taken at
// render time, i.e. always before the async refresh lands. `state.installed`
// is exactly what the read sets, so the counter is the observable.
// ---------------------------------------------------------------------------
{
  const prevBridge = window.hermesDesktop
  const reads = []
  const writes = []
  const installed = new Map() // path → content; missing key = hook absent
  window.hermesDesktop = {
    desktopPluginsRoot: async () => '/home/u/.hermes/desktop-plugins',
    getMachineProfile: async () => ({ username: 'u' }),
    readFileText: async p => { reads.push(p); return installed.has(p) ? { text: installed.get(p) } : { error: 'ENOENT' } },
    writeTextFile: async (path, content) => { writes.push([path, content]); return { path } },
    trashPath: async () => {},
  }
  const hookCtx = { ...ctx, os: { notify: () => {}, writeClipboard: () => true }, setTimeout: fn => fn() }
  // One mount = one HookSection() call. Dropping the returned tree is the
  // unmount: the component instance (and its per-instance state) is gone.
  const mount = async () => { const tree = pluginMod.HookSection({ ctx: hookCtx }); await settle(); return tree }

  // The hook is really installed (hook file present with content).
  installed.set(hookTarget, '#!/bin/sh\nexit 0\n')
  await mount()
  assert.equal(reads.length, 1, 'first mount reads the hook status exactly once')
  assert.equal(reads[0], hookTarget, 'the status read targets the hook file')

  // Unmount → remount (close and re-open the settings page): the status MUST be
  // read again instead of being answered from a process-wide flag.
  await mount()
  assert.equal(reads.length, 2,
    'remount must RE-READ the hook status (one read per mount, not one per process)')

  // The other direction: the hook was removed meanwhile (`make uninstall-hook`
  // in a terminal, a fresh Omarchy install). The next mount must see that too,
  // so the status cannot be stale in either direction.
  installed.delete(hookTarget)
  await mount()
  assert.equal(reads.length, 3, 'every further mount reads again — no state across mounts')
  assert.equal(writes.length, 0, 'mounting alone never writes the hook')

  window.hermesDesktop = prevBridge
}

// ---------------------------------------------------------------------------
// A1-2 (P1) — the hook lives in the USER's config dir, not in the Hermes data
// dir. `omarchyHookPath()` used to strip a `/.hermes` suffix off HERMES_HOME;
// with HERMES_HOME=/srv/hermes that produced /srv/.config/omarchy/... — a path
// Omarchy never executes, while the status still said "installiert".
// The bridge offers no home IPC (apps/desktop/electron/preload.ts exposes only
// `desktopPluginsRoot` and `getMachineProfile`), so the home comes from the
// SHAPE of HERMES_HOME (`…/.hermes` → its parent) or from
// `getMachineProfile().username` → `/home/<user>` (same candidates as
// omarchyThemeNamePath). No probe-by-read: the hook does not exist before the
// install, so a read-test would discard the right candidate. No home at all →
// no path (the page reports that instead of writing to a guessed path).
// ---------------------------------------------------------------------------
{
  // `undefined` username = a bridge without a machine profile (older build).
  const runCase = async ({ hermesHome, username }) => {
    const reads = []
    const writes = []
    const prevBridge = window.hermesDesktop
    window.hermesDesktop = {
      desktopPluginsRoot: async () => hermesHome + '/desktop-plugins',
      ...(username === undefined ? {} : { getMachineProfile: async () => ({ username }) }),
      readFileText: async p => { reads.push(p); return { error: 'ENOENT' } },
      writeTextFile: async (path, content) => { writes.push([path, content]); return { path } },
      trashPath: async () => {},
    }
    const hookCtx = { ...ctx, os: { notify: () => {}, writeClipboard: () => true }, setTimeout: fn => fn() }
    const tree = pluginMod.HookSection({ ctx: hookCtx })
    await settle()
    const btn = findInstaller(tree)
    if (btn) { btn.props.onClick(); await settle() }
    window.hermesDesktop = prevBridge
    return { reads, writes, hasButton: Boolean(btn) }
  }

  // Case 1: default HERMES_HOME = $HOME/.hermes → $HOME/.config/omarchy/…
  const a = await runCase({ hermesHome: '/home/u/.hermes', username: 'u' })
  assert.deepEqual(a.writes.map(w => w[0]), [hookTarget],
    'HERMES_HOME=$HOME/.hermes → hook under $HOME/.config/omarchy/')
  // Mount + post-install refresh both read the same, resolved path.
  assert.ok(a.reads.length >= 1, 'the mount reads the hook status')
  assert.deepEqual([...new Set(a.reads)], [hookTarget], 'the status read uses the same $HOME path')

  // Case 2: custom HERMES_HOME (/srv/hermes) → the SAME $HOME path, never
  // /srv/.config/... — this is the regression the old suffix-strip caused.
  const b = await runCase({ hermesHome: '/srv/hermes', username: 'u' })
  assert.deepEqual(b.writes.map(w => w[0]), [hookTarget],
    'HERMES_HOME=/srv/hermes → hook still under $HOME/.config/omarchy/, not /srv/.config/...')
  assert.ok(b.reads.length >= 1, 'the mount reads the hook status')
  assert.deepEqual([...new Set(b.reads)], [hookTarget],
    'the status read follows the user home, not the Hermes data dir')
  assert.ok(!b.reads.concat(b.writes.map(w => w[0])).some(p => String(p).startsWith('/srv/')),
    'no bridge call may target /srv/… (that is HERMES_HOME, not a home)')

  // Case 3: neither a `~/.hermes` shape nor a username → no path. The page must
  // not claim "installiert" and must not touch a guessed path.
  // The message it sets is a state update that the SDK stub's no-op setState
  // cannot repaint (a tree is a render-time snapshot), so the fallback is
  // enforced twice: no bridge call at a guessed path, and the no-home branch is
  // wired into the component the page renders.
  const c = await runCase({ hermesHome: '/srv/hermes', username: undefined })
  assert.equal(c.hasButton, true, 'the page still offers Installieren (it explains why it cannot)')
  assert.deepEqual(c.writes, [], 'no resolvable home → nothing is written (no guessed path)')
  assert.deepEqual(c.reads, [], 'no resolvable home → no guessed path is read either')
  assert.match(String(pluginMod.HookSection), /msg: HOOK_NO_HOME/,
    'the page reports the unresolvable home (msg path) instead of claiming "installiert"')

  // The resolver itself, directly: null instead of a guessed path.
  assert.equal(await pluginMod.omarchyHookPath({ desktopPluginsRoot: async () => '/srv/hermes/desktop-plugins' }), null,
    'omarchyHookPath() returns null when no home can be resolved')
  assert.equal(await pluginMod.omarchyHookPath({ desktopPluginsRoot: async () => '/srv/hermes/desktop-plugins', getMachineProfile: async () => ({ username: 'u' }) }),
    hookTarget, 'omarchyHookPath() falls back to /home/<user> from the machine profile')
}

Date.now = realNow
delete globalThis.window

// ---------------------------------------------------------------------------
// Hard assertions — these are *enforced* on every CI run.
//
// Reusing the BT.709 luma formula from desktop/plugin.js. The renderer's
// `renderedModeFor()` (apps/desktop/src/themes/context.tsx:251-266) uses the
// same threshold: luma > 0.5 → render as 'light'; otherwise 'dark'. A theme
// whose `colors.bg` and `darkColors.bg` both exceed 0.5 (or both fall under)
// locks the UI in one mode regardless of the user-selected mode — the
// original lupine-flip bug. The luma-difference threshold below (= 0.5)
// guarantees each palette lands on the correct side of the renderer cutoff.
// ---------------------------------------------------------------------------

const REQUIRED_KEYS = [
  'background', 'foreground',
  'card', 'cardForeground',
  'popover', 'popoverForeground',
  'primary', 'primaryForeground',
  'secondary', 'secondaryForeground',
  'accent', 'accentForeground',
  'muted', 'mutedForeground',
  'border', 'input', 'ring',
  'midground', 'composerRing',
  'destructive', 'destructiveForeground',
  'sidebarBackground', 'sidebarBorder',
  'userBubble', 'userBubbleBorder',
]

// A) Luma-Kontrast — each palette must land on the correct side of the
// renderer threshold (>= 0.5 = light, < 0.5 = dark). Running difference:
const LUMA_DIFF_MIN = 0.5
for (const { data: t } of themes) {
  const lb = luma(t.colors.background)
  const db = luma(t.darkColors.background)
  const diff = Math.abs(lb - db)
  assert.ok(diff >= LUMA_DIFF_MIN,
    `${t.name}: colors/darkColors backgrounds too close (${lb.toFixed(3)} vs ${db.toFixed(3)}, diff ${diff.toFixed(3)} < ${LUMA_DIFF_MIN})`)
  // The lighter palette must actually be light enough to render as 'light';
  // the darker one must fall below 0.5 so the renderer paints as 'dark'.
  // Without this, the dark variant of a light Omarchy theme (lupine, etc.)
  // shows the renderer two near-identical bright palettes and the mode flips.
  assert.ok(lb >= 0.5,
    `${t.name}: colors.background luma ${lb.toFixed(3)} < 0.5 — UI would render dark instead of light`)
  assert.ok(db < 0.5,
    `${t.name}: darkColors.background luma ${db.toFixed(3)} >= 0.5 — UI would render light instead of dark (the lupine-flip bug)`)
}

// B) Vollständigkeit — every theme must ship every UI variable. 26 themes ×
// 2 palettes × 25 keys × 2 = 2600 assertions
//   (26 × 2 palettes × 25 keys; each key fires 2 asserts: existence + Hex-Match).
//   A theme missing e.g. `composerRing` would silently inherit the renderer's
//   default and lose brand identity.
for (const { data: t } of themes) {
  for (const pal of ['colors', 'darkColors']) {
    for (const k of REQUIRED_KEYS) {
      assert.ok(t[pal][k], `${t.name}.${pal}.${k} missing`)
      assert.match(t[pal][k], HEX, `${t.name}.${pal}.${k} = ${t[pal][k]} (not #rrggbb)`)
    }
  }
}

// D) entry.mode ist gesetzt — every registered theme must carry a mode of
// 'light' or 'dark' so ThemeCard's setMode(entry.mode) call has a valid
// ThemeMode ('light' | 'dark' | 'system') to feed the React context.
// The plugin only forwards entry.theme as the contribution data, so the
// mode is read back from theme.description (buildTheme encodes
// `'Omarchy · <label> · <mode>'`). One assert per registered theme — 26
// total (5 light + 21 dark).
const ENTRY_MODE_RE = /· (\w+)$/
for (const { data: t } of themes) {
  const m = t.description.match(ENTRY_MODE_RE)?.[1]
  assert.ok(m === 'light' || m === 'dark',
    `${t.name}: theme.mode (parsed from description) is neither 'light' nor 'dark' (got: ${JSON.stringify(m)})`)
}

// C) Identitäts-Assertion (Markentreue) — accent/primary/ring are the brand
// surface; they must be identical across the light and dark palette. The
// synthesiser derives `primary`/`ring`/`midground`/`composerRing` from
// `c.accent`, but `accent` itself is shipped into both palettes directly — so
// divergence here means a generator or synth regression.
for (const { data: t } of themes) {
  assert.equal(t.colors.accent, t.darkColors.accent,
    `${t.name}: Akzent unterscheidet sich zwischen colors und darkColors`)
  assert.equal(t.colors.primary, t.darkColors.primary,
    `${t.name}: Primary unterscheidet sich (Brand-Identität)`)
  assert.equal(t.colors.ring, t.darkColors.ring,
    `${t.name}: Ring unterscheidet sich (Focus-Ring-Drift)`)
  // midground + composerRing are also accent-derived and should match.
  assert.equal(t.colors.midground, t.darkColors.midground,
    `${t.name}: midground unterscheidet sich`)
  assert.equal(t.colors.composerRing, t.darkColors.composerRing,
    `${t.name}: composerRing unterscheidet sich`)
}

// ---------------------------------------------------------------------------
// Documenting block — *no* failing assertions by design.
//
// `desktop/plugin.js` builds BOTH a Light palette (`colors`) and a Dark
// palette (`darkColors`) for every registered theme. For a `mode:'dark'`
// theme, `colors` is synthesised from the dark base via `synthLightFromDark`
// and `darkColors` is the native dark — the renderer can flip modes
// confidently.
//
// For a `mode:'light'` theme the same code path synthesises a Dark
// counterpart via `synthDarkFromLight`, but that uses `darker_background`
// as the surface — and for light Omarchy palettes `darker_background` is
// *not* actually dark, it's just a lighter shade of grey. The result:
// `darkColors.background` stays high-luma, and Hermes Desktop cannot flip
// into Dark mode on those themes — it sees two bright palettes.
//
// This block prints the actual luminances for every registered theme. The
// synthesiser is intentional (commit 7514c45), so there are no hard
// assertions here. When `synthDarkFromLight()` is fixed, the verdict column
// will start flipping for the light-mode themes — that is the green light.
// ---------------------------------------------------------------------------

// ITU-R BT.709 luma — copied verbatim from desktop/plugin.js line 36.
function luma(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Sanity-check the BT.709 formula. Bounded values, not arbitrary.
assert.equal(luma('#000000'), 0, 'luma(#000000) must be 0')
assert.equal(luma('#ffffff'), 1, 'luma(#ffffff) must be 1')
// Primary colors must match the BT.709 weights exactly: R=0.2126, G=0.7152, B=0.0722.
assert.equal(luma('#ff0000').toFixed(4), '0.2126', 'luma(pure red) must be 0.2126')
assert.equal(luma('#00ff00').toFixed(4), '0.7152', 'luma(pure green) must be 0.7152')
assert.equal(luma('#0000ff').toFixed(4), '0.0722', 'luma(pure blue) must be 0.0722')
assert.ok(luma('#000000') <= luma('#7f7f7f') && luma('#7f7f7f') <= luma('#ffffff'),
  'luma must be monotonic in brightness')

// Build the per-theme luminance table. The mode is the trailing word in
// the description ('Omarchy · <label> · <mode>') — the only place the
// plugin registration exposes it.
const MODE_RE = /· (\w+)$/
const rows = themes.map(({ data: t }) => {
  const mode = (t.description.match(MODE_RE)?.[1]) ?? '?'
  const lBg = luma(t.colors.background)
  const dBg = luma(t.darkColors.background)
  const lightVerdict = lBg >= 0.5 ? 'ok:light' : 'WARN:low'
  const darkVerdict = dBg <= 0.3 ? 'ok:dark' : (mode === 'light' ? 'light→high' : 'WARN:high')
  return {
    slug: t.name,
    mode,
    cBg: t.colors.background,
    dBg: t.darkColors.background,
    lL: lBg,
    lD: dBg,
    vL: lightVerdict,
    vD: darkVerdict,
  }
})

// Cluster light-mode themes first so the high-luma outliers are easy to spot.
rows.sort((a, b) => (a.mode === b.mode ? b.lL - a.lL : a.mode.localeCompare(b.mode)))

const pad = (s, n) => String(s).padEnd(n)
console.log('')
console.log('Light/Dark palette luminance (ITU-R BT.709)')
console.log('-'.repeat(96))
console.log(`${pad('slug', 22)} ${pad('mode', 6)} ${pad('colors.bg', 10)} ${pad('luma(L)', 9)} ${pad('darkColors.bg', 15)} ${pad('luma(D)', 9)} verdict`)
console.log('-'.repeat(96))
for (const r of rows) {
  console.log(`${pad(r.slug, 22)} ${pad(r.mode, 6)} ${pad(r.cBg, 10)} ${pad(r.lL.toFixed(3), 9)} ${pad(r.dBg, 15)} ${pad(r.lD.toFixed(3), 9)} ${r.vL} / ${r.vD}`)
}
console.log('-'.repeat(96))

const lightRows = rows.filter(r => r.mode === 'light')
const darkRows  = rows.filter(r => r.mode === 'dark')
const lightWithHighDarkBg = lightRows.filter(r => r.lD >= 0.5).length
const darkWithLowDarkBg   = darkRows.filter(r  => r.lD <= 0.3).length

console.log('')
console.log(`Finding: ${lightRows.length} light themes + ${darkRows.length} dark themes registered.`)
console.log(`Light themes with high-luma darkColors.background (>=0.5): ${lightWithHighDarkBg}/${lightRows.length} — dual-helle Paletten`)
console.log(`Dark  themes with low-luma  darkColors.background (<=0.3): ${darkWithLowDarkBg}/${darkRows.length} — dual-kontrastreiche Paletten`)

console.log('')
console.log(`ok — ${themes.length} themes, ${palette.length} palette commands, ${settingsPages.length} settings page, skin.changed subscription: ${skinListener ? 'yes' : 'no'}`)
