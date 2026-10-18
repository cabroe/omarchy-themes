// @ts-check
// Type-checked by `make typecheck` (tsc --allowJs --checkJs --noEmit). NOT
// compiled — Hermes Desktop loads this file as plain ESM at runtime; the
// typedefs and JSDoc are consumed only by tsc. Shared shapes live in
// ./types.d.ts.
/**
 * desktop/sync.js — CLI/Omarchy → desktop sync state machine.
 *
 * Extracted from desktop/plugin.js (was inline in register(), ~280 LOC).
 * Encapsulates:
 *
 *   • Local requestMode mirror (storage-event poke for ThemeProvider).
 *     The probe at module load captures `sdk.requestMode` once; a future SDK
 *     that re-exports it wins automatically. Today's SDK has none — the
 *     mirror below handles the change (write to PROFILE_MODES_KEY +
 *     MODE_KEY, then dispatch a StorageEvent so the ThemeProvider repaints).
 *
 *   • Four sync doors that all converge on the same apply path:
 *       1. `skin.changed` from the active gateway
 *       2. Omarchy's current/theme.name (the earliest signal, ~0.5 s in)
 *       3. `display.skin` in this machine's Hermes config (~2-3 s later)
 *       4. colors.toml itself (catches same-slug palette edits)
 *
 *   • Dynamic theme registration — Omarchy themes the baked table does not
 *     know (user overlay, themes added after the last generate) are read
 *     from current/theme/colors.toml and offered as the ONE replaceable
 *     theme `omarchy-current`.
 *
 *   • Dispose-race protection via module-level INSTANCE / per-instance
 *     epoch + myInstance counter; `alive()` short-circuits every async
 *     handler so a disposed instance cannot leak into the next.
 *
 * State (`dynamic`, `omarchySlug`, `skipSync`, `dynStore`, `INSTANCE`,
 * `colorsTimer`, `lastRequest`) is closure-shared across all plugin
 * instances on the module level — same pattern as the original code.
 *
 * The text parsers (displaySkin, themeName, paletteFromToml) live in
 * `./lib/palette-parsers.js` and are imported here so the sync module
 * only owns the wiring. `buildTheme`, `THEMES`, `isKnown`, `RAW_MODE`
 * and `BUILTIN_NAMES` are plugin-local and injected via `createSync`'s
 * deps argument to avoid an import cycle with plugin.js.
 */
/** @typedef {import('./types').AliveCheck} AliveCheck */
/** @typedef {import('./types').DesktopTheme} DesktopTheme */
/** @typedef {import('./types').Hex} Hex */
/** @typedef {import('./types').HermesBridge} HermesBridge */
/** @typedef {import('./types').Mode} Mode */
/** @typedef {import('./types').Palette} Palette */
/** @typedef {import('./types').PluginContext} PluginContext */
/** @typedef {import('./types').PluginStorage} PluginStorage */
/** @typedef {import('./types').RegisterCurrentResult} RegisterCurrentResult */
/** @typedef {import('./types').ThemeEntry} ThemeEntry */
/** @typedef {import('./types').ThemeModeContext} ThemeModeContext */
/**
 * One async callback for an applied value; used by the file-watch doors.
 * The watch path catches failures so the caller can stay simple.
 * @typedef {(value: string) => void | Promise<void>} ApplyCallback
 */
/**
 * Variant of HermesBridge.readFileText/watchPreviewFile — promise-returning,
 * returns `null` when the file is missing. The plugin imports the bridge
 * type from types.d.ts but uses these local helpers as an `any`-tolerant
 * record shape (function-bag, no real class).
 * @typedef {Record<string, (...args: any[]) => any | Promise<any>>} BridgeLike
 */
/** @typedef {{ slug: string, name: string | null }} WatchName */
/**
 * Slug → DesktopTheme registration handle returned by `registerCurrent`.
 * Allows callers to dispose the previous dynamic registration before adding
 * a new one; `stop` is the disposer from `ctx.register`.
 * @typedef {{ slug: string, entry: ThemeEntry, sig: string, stop: () => void }} DynamicRegistration
 */
/**
 * Cached dynamic-theme registration persisted to plugin storage so a launch
 * under the skip toggle can restore exactly what was shown before.
 * @typedef {{ slug: string, label: string, mode: Mode, theme: DesktopTheme }} PersistedDynamic
 */
import * as sdk from '@hermes/plugin-sdk'
const { requestTheme, THEMES_AREA } = sdk
// `requestMode` is the SDK contract for changing the active mode from
// outside React. The current SDK does not export it (defined internally in
// apps/desktop/src/themes/request.ts, not re-exported from sdk/index.ts), so
// this binding is `null` today. Probe the namespace at module load so the
// plugin works either way: a future SDK that re-exports requestMode wins;
// today's host gets the local storage-event mirror below.
const SDK_REQUEST_MODE = typeof sdk.requestMode === 'function' ? sdk.requestMode : null
import { displaySkin, themeName, paletteFromToml } from './lib/palette-parsers.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MODE_KEY          = 'hermes-desktop-mode-v1'
const PROFILE_MODES_KEY = 'hermes-desktop-profile-modes-v1'
const LAST_PROFILE_KEY  = 'hermes-desktop-active-profile-v1'

const DYNAMIC_NAME = 'omarchy-current' // the ONE replaceable dynamic theme
const DEDUPE_MS    = 15000             // apply skin; same name within the window → no-op

// ---------------------------------------------------------------------------
// Shared state (module-level, survives every plugin instance)
// ---------------------------------------------------------------------------
//   dynamic      current dynamic registration { slug, entry, sig, stop }
//   omarchySlug  current Omarchy theme.name; aliased on `omarchy` skin
//   skipSync     cached state of Omarchy's skip-hermes-theme-changes toggle
//   dynStore     ctx.storage of the live instance (palette persistence)
//   INSTANCE     bumped on dispose — alive() compares myInstance === INSTANCE
//   colorsTimer  debounce for colors.toml changes (250 ms window)
//   lastRequest  local requestMode mirror — (profile, mode) target of last
//                dispatch; idempotent no-op guard
/** @type {DynamicRegistration | null} */
let dynamic     = null
/** @type {string | null} */
let omarchySlug = null
/** @type {boolean} */
let skipSync    = false
/** @type {PluginStorage | null} */
let dynStore    = null
/** @type {number} */
let INSTANCE    = 0
/** @type {ReturnType<typeof setTimeout> | number} */
let colorsTimer = 0
/** @type {{ profile: string | null, mode: string | null }} */
let lastRequest = { profile: null, mode: null }

// ---------------------------------------------------------------------------
// Local requestMode mirror + applyEntry
// ---------------------------------------------------------------------------
// Mirrors ThemeProvider's modePref.assign: the "default" profile owns the
// global slot; a named profile gets its own record entry and mirrors into
// the global slot. Then poke the provider's `storage` listener — it re-
// resolves the mode from storage and repaints through its own applyTheme.
/**
 * Mirror of ThemeProvider's modePref.assign for outside-React callers.
 * Writes to MODE_KEY (and PROFILE_MODES_KEY for named profiles), then
 * dispatches a `storage` event so the provider repaints. Idempotent for
 * the same (profile, mode) target so a fast double-emit does not flicker.
 * @param {Mode} mode
 */
function requestMode(mode) {
  // Prefer the host's contract when the SDK exposes it; the mirror below is
  // the fallback that pokes the ThemeProvider via a storage event.
  if (SDK_REQUEST_MODE) return SDK_REQUEST_MODE(mode)
  if (typeof window === 'undefined') return
  try {
    const ls = window.localStorage
    const profile = (ls.getItem(LAST_PROFILE_KEY) || '').trim() || 'default'
    if (lastRequest.profile === profile && lastRequest.mode === mode) return  // idempotent no-op
    lastRequest = { profile, mode }
    if (profile !== 'default') {
      let record = {}
      try {
        const parsed = JSON.parse(ls.getItem(PROFILE_MODES_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) record = parsed
      } catch (_) { /* corrupt record — start fresh like the host does */ }
      ls.setItem(PROFILE_MODES_KEY, JSON.stringify({ ...record, [profile]: mode }))
    }
    ls.setItem(MODE_KEY, mode)
    window.dispatchEvent(new StorageEvent('storage', { key: MODE_KEY, newValue: mode, storageArea: ls }))
  } catch (_) { /* storage unavailable — the mode stays as it is */ }
}

// applyEntry: apply one baked or dynamic entry. Exported because plugin.js
// uses it as the `run:` callback for every palette ⌘K row (no lookup needed
// — the row already knows its entry).
/**
 * Apply one ThemeEntry — sets the mode via the local mirror, then calls
 * the SDK `requestTheme` for the matching palette name.
 * @param {ThemeEntry} entry
 */
export function applyEntry(entry) {
  requestMode(entry.mode)
  requestTheme(entry.theme.name)
}

// ---------------------------------------------------------------------------
// Omarchy file helpers
// ---------------------------------------------------------------------------
/**
 * Resolves the Hermes home directory from the bridge — strips the trailing
 * `desktop-plugins/` portion off the desktop-plugins-root path.
 * @param {BridgeLike} bridge
 * @returns {Promise<string>}
 */
const hermesHomeOf = async bridge =>
  String(await bridge.desktopPluginsRoot()).replace(/[\\/]desktop-plugins[\\/]?$/, '')

// Omarchy hard-codes `$HOME/.local/state/omarchy/current/theme.name`. $HOME is
// the parent of a default `~/.hermes`; else fall back to /home/<user>.
/**
 * Resolves Omarchy's `current/theme.name` path, trying `$HOME` first
 * (parent of a default `~/.hermes`) and `/home/<user>` as fallback.
 * @param {BridgeLike} bridge
 * @returns {Promise<string | null>}
 */
async function omarchyThemeNamePath(bridge) {
  const rel = '/.local/state/omarchy/current/theme.name'
  const candidates = []
  const home = await hermesHomeOf(bridge)
  if (/[\\/]\.hermes$/.test(home)) candidates.push(home.replace(/[\\/]\.hermes$/, '') + rel)
  const user = (await bridge.getMachineProfile?.())?.username
  if (user) candidates.push('/home/' + user + rel)
  for (const path of candidates) {
    const file = await bridge.readFileText(path).catch(() => null)
    if (typeof file?.text === 'string') return path
  }
  return null
}

// Files next to theme.name: `current/theme/colors.toml`, `toggles/<flag>`.
/**
 * Sibling files of `current/theme.name` — accepts a `rel` path (e.g.
 * `current/theme/colors.toml` or `toggles/<flag>`) and returns the
 * corresponding sibling or null when theme.name cannot be located.
 * @param {BridgeLike} bridge
 * @param {string} rel sibling path relative to current/state/omarchy/
 * @returns {Promise<string | null>}
 */
async function omarchyFile(bridge, rel) {
  const path = await omarchyThemeNamePath(bridge)
  return path && path.replace(/current\/theme\.name$/, rel)
}

/**
 * Reads a text file via the bridge, returning the body or null. Tolerates
 * missing paths and bridge errors (returns null in both cases).
 * @param {BridgeLike} bridge
 * @param {string | null} path
 * @returns {Promise<string | null>}
 */
async function readText(bridge, path) {
  const file = path ? await bridge.readFileText(path).catch(() => null) : null
  return typeof file?.text === 'string' ? file.text : null
}

// Omarchy's toggle convention: the flag is a file in toggles/.
/**
 * Reads the `toggles/skip-hermes-theme-changes` flag and caches the result
 * in the module-level `skipSync`. Run on every skin.changed event.
 * @param {BridgeLike} bridge
 * @returns {Promise<void>}
 */
async function refreshSkip(bridge) {
  skipSync = (await readText(bridge, await omarchyFile(bridge, 'toggles/skip-hermes-theme-changes'))) !== null
}

// ---------------------------------------------------------------------------
// File-watch primitive + the two named wrappers (doors 2 & 3)
// ---------------------------------------------------------------------------
// Watch one local file through the desktop's preview file-watch bridge
// (window.hermesDesktop — the renderer has no fs). `parse(text)` extracts
// the value; every change of it calls onValue.
//
// Launch: the value last seen is remembered in the plugin's own storage
// under `seenKey`. If Omarchy switched themes while Hermes was closed, the
// stored value differs and the desktop catches up. If nothing changed, the
// launch only seeds the baseline — it must not stomp a theme picked in the
// desktop. Returns a disposer; a host without the bridge gets a no-op.
/**
 * Watch one local file through the desktop's preview file-watch bridge
 * (`window.hermesDesktop` — the renderer has no fs). `parse(text)` extracts
 * the value; every change calls `onValue`. On launch, the value is remembered
 * in plugin storage under `seenKey`; if the stored value differs (Omarchy
 * switched themes while Hermes was closed), the desktop catches up. A host
 * without the bridge returns a no-op disposer.
 * @param {(bridge: BridgeLike) => Promise<string | null>} resolvePath
 * @param {(text: string) => string | null} parse
 * @param {ApplyCallback} onValue
 * @param {PluginStorage | undefined} store
 * @param {string} seenKey
 * @returns {() => void} disposer
 */
function watchFile(resolvePath, parse, onValue, store, seenKey) {
  /** @type {BridgeLike | undefined} */
  const bridge = typeof window === 'undefined' ? undefined : /** @type {any} */ (window).hermesDesktop
  if (!bridge?.desktopPluginsRoot || !bridge.readFileText || !bridge.watchPreviewFile || !bridge.onPreviewFileChanged) {
    return () => {}
  }
  let disposed = false
  /** @type {string | null} */
  let watchId = null
  /** @type {string | null} */
  let path = null
  /** @type {string | null} */
  let last = null

  const read = async () => {
    /** @type {{text?: string} | null} */
    const file = await bridge.readFileText(path)
    return typeof file?.text === 'string' ? parse(file.text) : null
  }
  /** @type {() => void} */
  const offChanged = /** @type {any} */ (bridge).onPreviewFileChanged(
    /** @param {{id: string} | null} payload */
    async payload => {
      if (disposed || !watchId || payload?.id !== watchId) return
      try {
        const value = await read()
        if (disposed || !value || value === last) return
        last = value
        store?.set(seenKey, value)
        Promise.resolve(onValue(value)).catch(() => { /* a failing door must not kill the watcher */ })
      } catch (_) { /* unreadable mid-write — the next change event retries */ }
    }
  )

  ;(async () => {
    path = await resolvePath(bridge)
    if (!path) return
    last = await read()
    const seen = store?.get(seenKey, null)
    if (last) store?.set(seenKey, last)
    if (!disposed && seen && last && seen !== last) Promise.resolve(onValue(last)).catch(() => {})
    const watch = await bridge.watchPreviewFile(path)
    if (!watch?.id) return
    if (disposed) bridge.stopPreviewFileWatch?.(watch.id)
    else watchId = watch.id
  })().catch(() => { /* file not there — the other doors still sync */ })

  return () => {
    disposed = true
    offChanged?.()
    if (watchId) bridge.stopPreviewFileWatch?.(watchId)
  }
}

// The two file doors: Omarchy's theme.name (written ~0.5 s into
// `omarchy theme set`, right after the theme swap — the earliest signal)
// and `display.skin` in the Hermes config (written by the theme-set hook
// ~2-3 s later via `hermes skin use`; covers `hermes skin use` run by hand).
/**
 * Door 2: watches Omarchy's `current/theme.name`.
 * @param {ApplyCallback} onTheme
 * @param {PluginStorage | undefined} store
 */
const watchOmarchyTheme = (onTheme, store) => watchFile(omarchyThemeNamePath, themeName, onTheme, store, 'last-theme')
/**
 * Door 3: watches `display.skin` in the Hermes config.yaml.
 * @param {ApplyCallback} onSkin
 * @param {PluginStorage | undefined} store
 */
const watchConfigSkin = (onSkin, store) =>
  watchFile(async b => (await hermesHomeOf(b)) + '/config.yaml', displaySkin, onSkin, store, 'last-skin')

// ---------------------------------------------------------------------------
// Dynamic theme registration (from current/theme/colors.toml)
// ---------------------------------------------------------------------------
// Register the current Omarchy theme from colors.toml. Returns 'new' when
// the dynamic theme changed, 'same' when it already matches, null when
// colors.toml gave no palette. `alive` aborts a disposed instance before
// it touches shared state. The palette is persisted so a launch under the
// skip toggle can restore exactly what was shown before.
/**
 * @param {PluginContext} ctx
 * @param {BridgeLike} bridge
 * @param {string} slug
 * @param {{
 *   buildTheme: (slug: string, c: Palette, taken: Set<string>) => ThemeEntry | null,
 * }} deps injected by plugin.js (avoids an import cycle)
 * @param {AliveCheck} [alive]
 * @returns {Promise<RegisterCurrentResult>}
 */
async function registerCurrent(ctx, bridge, slug, deps, alive = () => true) {
  const text = await readText(bridge, await omarchyFile(bridge, 'current/theme/colors.toml'))
  if (!alive()) return null
  const c = text && paletteFromToml(text)
  const entry = c && deps.buildTheme(slug, c, new Set())
  if (!entry) return null
  entry.theme.name = DYNAMIC_NAME
  const sig = slug + JSON.stringify(entry.theme)
  if (dynamic?.sig === sig) return 'same'
  dynamic?.stop?.()
  dynamic = { slug, entry, sig, stop: ctx.register({ id: 'theme-current', area: THEMES_AREA, data: entry.theme }) }
  dynStore?.set('last-dynamic', JSON.stringify({ slug, label: entry.label, mode: entry.mode, theme: entry.theme }))
  return 'new'
}

// Launch: make the palette available again (the host does not persist it)
// and learn the current theme name and toggle. Registering is not a theme
// switch — and under the skip toggle the palette shown BEFORE is restored,
// not the one Omarchy has switched to since.
/**
 * @param {PluginContext} ctx
 * @param {BridgeLike} bridge
 * @param {{ isKnown: (name: string) => boolean, buildTheme: (slug: string, c: Palette, taken: Set<string>) => ThemeEntry | null }} deps
 * @param {AliveCheck} alive defaults to a permissive `() => true` when omitted
 * @returns {Promise<void>}
 */
async function primeCurrent(ctx, bridge, deps, alive = () => true) {
  /** @param {string} name */
  const isKnown = deps.isKnown
  try {
    const name = themeName((await readText(bridge, await omarchyThemeNamePath(bridge))) ?? '')
    if (!name || !alive()) return
    omarchySlug ??= name
    await refreshSkip(bridge)
    if (!alive() || isKnown(name)) return
    if (!skipSync) { await registerCurrent(ctx, bridge, name, deps, alive); return }
    const saved = dynStore?.get('last-dynamic', null)
    /** @type {PersistedDynamic | null} */
    let parsed = null
    try { parsed = JSON.parse(saved || 'null') } catch (_) { /* corrupt — nothing to restore */ }
    if (!parsed?.theme) return
    const sig = parsed.slug + JSON.stringify(parsed.theme)
    if (dynamic?.sig === sig) return
    dynamic?.stop?.()
    dynamic = { slug: parsed.slug, entry: parsed, sig, stop: ctx.register({ id: 'theme-current', area: THEMES_AREA, data: parsed.theme }) }
  } catch (_) { /* Omarchy not here — the baked themes still work */ }
}

// ---------------------------------------------------------------------------
// colors.toml watcher — the fourth door
// ---------------------------------------------------------------------------
// It catches the case no other door sees — the palette changed under the
// SAME unknown slug (edited custom theme, `omarchy theme set` re-run):
// re-register and force the repaint. Omarchy swaps current/theme by rename,
// which orphans a file watch after one event, so this watcher re-arms on
// every event instead of trusting a single watch to survive the swap.
//
// `callbacks` carries the in-flight dependencies (registered with the
// createSync closure): isKnown, apply, deps — keeps startColorsWatcher
// parameter-light.
/**
 * @param {PluginContext} ctx
 * @param {BridgeLike} bridge
 * @param {AliveCheck} alive
 * @param {{
 *   isKnown: (name: string) => boolean,
 *   apply: (name: string, opts?: { force?: boolean }) => void,
 *   deps: { isKnown: (name: string) => boolean, buildTheme: (slug: string, c: Palette, taken: Set<string>) => ThemeEntry | null }
 * }} callbacks
 * @returns {() => void} disposer closure (dereferences the latest `stop`)
 */
function startColorsWatcher(ctx, bridge, alive, callbacks) {
  let stop = () => {}
  const colorsArrived = () => {
    clearTimeout(colorsTimer)
    colorsTimer = setTimeout(() => {
      colorsTimer = 0
      ;(async () => {
        await refreshSkip(bridge)
        if (!alive() || skipSync || !omarchySlug || callbacks.isKnown(omarchySlug)) return
        if (await registerCurrent(ctx, bridge, omarchySlug, callbacks.deps, alive) === 'new' && alive()) {
          callbacks.apply(omarchySlug, { force: true })
        }
      })().catch(() => {})
    }, 250)
  }
  const armColors = async () => {
    const path = await omarchyFile(bridge, 'current/theme/colors.toml')
    if (!path || !alive()) return
    /** @type {string | null} */
    let id = null
    /** @type {() => void} */
    const off = /** @type {any} */ (bridge).onPreviewFileChanged(
      /** @param {{id: string} | null} payload */
      async payload => {
        if (!id || payload?.id !== id) return
        off()
        void bridge.stopPreviewFileWatch?.(id)
        if (!alive()) return
        void armColors() // the swap orphaned this watch — watch the path again
        colorsArrived()
      }
    )
    const watch = await bridge.watchPreviewFile(path).catch(() => null)
    if (!watch?.id) { off(); return }
    id = watch.id
    stop = () => { off(); void bridge.stopPreviewFileWatch?.(id) }
  }
  void armColors().catch(() => { /* file not there — the other doors still sync */ })
  // Return a closure that dereferences the latest `stop`. Mirrors the
  // original `let colorsStop` + `() => colorsStop()` pattern.
  return () => stop()
}

// ---------------------------------------------------------------------------
// Public factory — createSync
// ---------------------------------------------------------------------------
// Returns disposers that the caller appends to its own list. The factory
// wires up the per-instance wiring (skin.changed listener, file watches,
// colors.toml watcher, primeCurrent call) and supplies the final disposer
// that resets shared state for the next instance.
//
// `deps` (injected by plugin.js):
//   THEMES          baked entries, used by applySkin for slug → entry lookup
//   isKnown         baked slug or built-in name guard
//   buildTheme      palette builder (lives in ./lib/theme-builder.js)
//   RAW_MODE        native mode of every Omarchy palette incl. collisions
//   BUILTIN_NAMES   Hermes Source-of-Truth set, used for built-in painting
/**
 * Wires up the per-instance sync machinery for one plugin instance and
 * returns a list of disposers the caller appends to its own disposal
 * queue. The last entry in the array resets shared module state
 * (`INSTANCE++` etc.) so the next instance starts clean.
 * @param {{
 *   ctx: PluginContext,
 *   bridge: BridgeLike | undefined,
 *   deps: {
 *     THEMES: ThemeEntry[],
 *     isKnown: (name: string) => boolean,
 *     buildTheme: (slug: string, c: Palette, taken: Set<string>) => ThemeEntry | null,
 *     RAW_MODE: Map<string, Mode>,
 *     BUILTIN_NAMES: Set<string>,
 *   },
 * }} factory input
 * @returns {Array<() => void>} disposers in registration order
 */
export function createSync({ ctx, bridge, deps }) {
  const disposers = []
  let epoch = 0
  const myInstance = ++INSTANCE
  const alive = () => myInstance === INSTANCE

  /** Per-instance dedupe state — closure-local, so disposing this instance
     *  releases the window; a fresh instance's first call always re-applies
     *  even if it names the same theme the previous instance just did. */
    let lastApplied = /** @type {{ name: string | null, at: number }} */ ({ name: null, at: 0 })

    // The Apply path. A theme/skin name from any door → desktop. Several
    // doors can report the same switch within seconds (theme.name,
    // config.yaml, gateway event); the later ones are no-ops unless forced.
    /**
     * @param {string | null} name skin/theme name (null becomes a no-op)
     * @param {{ force?: boolean }} [opts]
     */
    function applySkin(name, { force = false } = {}) {
      // Omarchy's own `omarchy` skin (omarchy-theme-set-hermes) always stands
      // for the current Omarchy theme; the host paints it as a single-
      // palette skin, so map it to the matching dual-palette entry instead.
      if (name === 'omarchy') name = omarchySlug
      if (!name || skipSync) return
      if (!force && name === lastApplied.name && Date.now() - lastApplied.at < DEDUPE_MS) return
      const entry = (/** @type {ThemeEntry | undefined} */ (
        deps.THEMES.find(/** @param {ThemeEntry} t */ t => t.slug === name)
      )) ?? (dynamic && dynamic.slug === name ? dynamic.entry : null)
      if (entry) {
        lastApplied = { name, at: Date.now() }
        applyEntry(entry)
        return
      }
      // Built-in collision (catppuccin, everforest): paint Hermes' own
      // built-in in the mode the Omarchy palette of that name ships with.
      // Any other skin is not ours — leave the user's appearance alone.
      if (deps.BUILTIN_NAMES.has(name) && deps.RAW_MODE.has(name)) {
        const mode = deps.RAW_MODE.get(name)
        if (mode === undefined) return
        lastApplied = { name, at: Date.now() }
        requestMode(mode)
        requestTheme(name)
      }
    }

  // The plugin registers the live storage here so we can read & write
  // persistence (last-dynamic) from registerCurrent/primeCurrent above.
  dynStore = ctx.storage ?? null

  disposers.push(ctx.onEvent('skin.changed', event => {
    const name = event?.payload?.name
    const mine = ++epoch
    // Same task as the host's handler, so the cached toggle decides; refresh
    // it for the next one.
    if (bridge?.readFileText) refreshSkip(bridge).catch(() => {})
    Promise.resolve().then(async () => {
      if (mine !== epoch) return
      // Omarchy republishes its `omarchy` skin on EVERY theme set (it
      // touches the skin file, so the gateway broadcasts even an unchanged
      // name). That is the reliable signal for a palette edit under the
      // SAME unknown slug: Omarchy swaps current/theme by rename, which
      // silences the colors.toml watch after its first event.
      if (name === 'omarchy' && !skipSync && bridge?.readFileText && omarchySlug && !deps.isKnown(omarchySlug)) {
        if (await registerCurrent(ctx, bridge, omarchySlug, deps, alive) === 'new' && mine === epoch && alive()) {
          return applySkin(omarchySlug, { force: true })
        }
      }
      applySkin(name, { force: true })
    })
  }))
  disposers.push(() => { epoch++ })

  if (bridge?.readFileText) {
    disposers.push(watchOmarchyTheme(async name => {
      omarchySlug = name
      await refreshSkip(bridge)
      if (!alive()) return
      if (!skipSync && !deps.isKnown(name)) await registerCurrent(ctx, bridge, name, deps, alive)
      if (alive()) applySkin(name)
    }, ctx.storage))

    disposers.push(watchConfigSkin(async name => {
      await refreshSkip(bridge)
      if (alive()) applySkin(name)
    }, ctx.storage))

    // Fourth door: colors.toml. See startColorsWatcher for the re-arm loop.
    const stopColors = startColorsWatcher(ctx, bridge, alive, {
      isKnown: deps.isKnown, apply: applySkin, deps,
    })
    disposers.push(stopColors)

    void primeCurrent(ctx, bridge, deps, alive)
  }

  // Final reset — disposers run in registration order, so the skin.changed
  // listener + epoch++ + watches + colorsStop run before this last one.
  // INSTANCE++ invalidates every alive() check; shared state is freed for
  // the next instance.
  disposers.push(() => {
    INSTANCE++
    clearTimeout(colorsTimer)
    dynamic?.stop?.(); dynamic = null; omarchySlug = null; skipSync = false; dynStore = null
    // The local requestMode mirror's (profile, mode) target — reset so a
    // fresh instance's first requestMode call always re-dispatches the
    // storage event (no cross-instance silent no-op).
    lastRequest = { profile: null, mode: null }
  })

  return disposers
}