// Smoke test: load plugin.js in plain Node with stubbed SDK modules,
// run register(ctx) against a fake context and validate every theme.
//
//   node tests/smoke.mjs
import * as nodeModule from 'node:module'
import assert from 'node:assert/strict'
import { resolve } from './stubs/loader.mjs'

// registerHooks (Node ≥ 22.15) is in-thread and not deprecated; fall back for older Node.
if (nodeModule.registerHooks) nodeModule.registerHooks({ resolve })
else nodeModule.register('./stubs/loader.mjs', import.meta.url)

const { default: plugin } = await import('../desktop/plugin.js')

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

assert.ok(themes.length >= 1, 'no themes registered')
assert.equal(palette.length, Math.min(themes.length, 30))
assert.equal(settingsPages.length, 1)
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
