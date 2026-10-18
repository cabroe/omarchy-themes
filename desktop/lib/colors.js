// @ts-check
// Type-checked by `make typecheck` (tsc --allowJs --checkJs --noEmit). NOT
// compiled — Hermes Desktop loads this file as plain ESM at runtime; the
// typedefs and JSDoc are consumed only by tsc. Shared shapes live in
// ./types.d.ts.
/**
 * colors.js — pure color math for the omarchy-themes plugin.
 *
 * No state, no side effects, no I/O. Every helper here is a deterministic
 * function of its arguments so the same `c` always produces the same palette.
 * The renderer's mode-flip threshold (>= 0.5 = light, < 0.5 = dark) lives in
 * apps/desktop/src/themes/context.tsx::renderedModeFor; tests/smoke.mjs
 * mirrors it. The two SURFACE_MIX / ACCENT_TEXT_LUMA constants below are
 * the only tuning knobs this plugin exposes — they are the single source of
 * truth for palette synthesis.
 *
 * Imported by:
 *   - desktop/lib/theme-builder.js  → uses synthLightFromDark,
 *                                      synthDarkFromLight, DEFAULT_TYPOGRAPHY,
 *                                      hexToRgb, mixHex, onAccent, modeOf
 *   - desktop/plugin.js             → uses modeOf for RAW_MODE lookup
 *   - desktop/lib/palette-parsers.js → uses luma() to derive the mode from
 *                                      the background luma when the toml
 *                                      does not specify one.
 *
 * Pure ESM, no build step. The host resolves `./lib/colors.js` relative to
 * the importer via Node's standard ESM resolver.
 */
/** @typedef {import('../types').ColorScale} ColorScale */
/** @typedef {import('../types').Hex} Hex */
/** @typedef {import('../types').Mode} Mode */
/** @typedef {import('../types').Palette} Palette */
/** @typedef {import('../types').Typography} Typography */

// ITU-R BT.709 luma (Rec.709). Used to rank colors by perceived brightness
// for the renderer threshold and for accent text colour choice.
/**
 * Rec.709 luma of a #rrggbb colour in [0..1].
 * @param {Hex} hex
 * @returns {number} luma in [0..1]
 */
export function luma(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Single-source-of-truth tuning constants for palette synthesis. The renderer
// threshold (>= 0.5 = light, < 0.5 = dark) is Hermes-internal and lives in
// apps/desktop/src/themes/context.tsx::renderedModeFor; tests/smoke.mjs
// mirrors it. These two constants are the only knobs this plugin exposes.
/** Native background pulled this far toward #000 / #fff. */
export const SURFACE_MIX_AMOUNT = 0.88
/** luma(accent) below → use #ffffff text on accent. */
export const ACCENT_TEXT_LUMA   = 0.55

/**
 * Foreground colour for text painted on top of an accent colour.
 * Returns '#ffffff' when the accent is dark (luma < ACCENT_TEXT_LUMA),
 * otherwise '#000000' for light accents.
 * @param {Hex} accent
 * @returns {Hex}
 */
export function onAccent(accent) { return luma(accent) < ACCENT_TEXT_LUMA ? '#ffffff' : '#000000' }

/**
 * Maps a Palette's `mode` token (or its absence) to the canonical Mode.
 * Defaults to 'dark' when the palette has no `mode` field.
 * @param {Palette} c
 * @returns {Mode}
 */
export function modeOf(c) { return (c.mode || 'dark').toLowerCase() === 'light' ? 'light' : 'dark' }

/**
 * Splits a #rrggbb hex into its three channel values.
 * @param {Hex} hex
 * @returns {[number, number, number]} r, g, b in [0..255]
 */
export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/**
 * Linear-interpolate two #rrggbb colours. amount=0 → a, amount=1 → b.
 * @param {Hex} a start colour
 * @param {Hex} b end colour
 * @param {number} amount interpolation factor in [0..1]
 * @returns {Hex} '#rrggbb' lowercase
 */
export function mixHex(a, b, amount) {
  const [ar, ag, ab] = hexToRgb(a), [br, bg, bb] = hexToRgb(b)
  /** @param {number} n @param {number} m */
  const t = (n, m) => Math.max(0, Math.min(255, Math.round(n + (m - n) * amount)))
  /** @param {number} n */
  const h = n => n.toString(16).padStart(2, '0')
  return '#' + h(t(ar, br)) + h(t(ag, bg)) + h(t(ab, bb))
}

// Default system typography — matches what the bundled Hermes presets use so
// the user's OS font + emoji rendering stay intact.
/** @type {Typography} */
export const DEFAULT_TYPOGRAPHY = {
  fontSans:
    '"Segoe WPC", "Segoe UI", -apple-system, BlinkMacSystemFont, "SF Pro Text", ' +
    '"SF Pro Display", system-ui, sans-serif, ' +
    '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", emoji',
  fontMono:
    '"JetBrains Mono", "Cascadia Code", "Cascadia Mono", "DejaVu Sans Mono", ' +
    '"Liberation Mono", "Noto Sans Mono", "SF Mono", ui-monospace, Menlo, Monaco, ' +
    'Consolas, monospace, "Apple Color Emoji", "Segoe UI Emoji", emoji',
}

// Build the *light* counterpart of a dark-mode Omarchy palette.
// Surface = background pulled 88% toward white. Omarchy's `lighter_background`
// is just a few shades lighter than the dark BG (still dark in feel), so we
// ignore it — the renderer's `renderedModeFor()` evaluates Rec.709 luma of the
// chosen palette's background and flips mode above 0.5; a dark `colors.bg`
// paints a dark UI in a light context. Accent stays the native Omarchy accent
// so brand identity is preserved across the mode toggle.
/**
 * Synthesises a Light `colors` half from a Dark-mode Omarchy palette.
 * @param {Palette} c raw palette (must have background + accent set)
 * @param {Hex} ac the accent (resolved at the call site)
 * @param {Hex} acFg the on-accent foreground ('#ffffff' or '#000000')
 * @returns {ColorScale}
 */
export function synthLightFromDark(c, ac, acFg) {
  const surface = mixHex(c.background, '#ffffff', SURFACE_MIX_AMOUNT)
  const card    = mixHex(surface, '#ffffff', 0.6)
  return {
    background: surface, foreground: '#1a1a1a',
    card, cardForeground: '#1a1a1a',
    popover: card, popoverForeground: '#1a1a1a',
    primary: ac, primaryForeground: acFg,
    secondary: card, secondaryForeground: '#1a1a1a',
    accent: ac, accentForeground: '#1a1a1a',
    muted: mixHex(surface, '#000000', 0.06),
    mutedForeground: mixHex('#1a1a1a', surface, 0.4),
    border: mixHex(surface, '#000000', 0.14),
    input:   mixHex(surface, '#000000', 0.14),
    ring: ac, midground: ac, composerRing: ac,
    destructive: c.red || '#b94a3a', destructiveForeground: '#ffffff',
    sidebarBackground: mixHex(surface, '#000000', 0.04),
    sidebarBorder:     mixHex(surface, '#000000', 0.14),
    userBubble:        mixHex(ac,       '#ffffff', 0.85),
    userBubbleBorder:  mixHex(surface, '#000000', 0.14),
  }
}

// Build the *dark* counterpart of a light-mode Omarchy palette.
// Surface = background pulled 88% toward black. Omarchy's `darker_background`
// for a light theme is only a slightly darker grey (e.g. lupine `#dedede`,
// luma 0.87 — the renderer reads that as "light" and flips the UI mode,
// making the dark variant look identical to the light one). `mixHex` toward
// black is the only way to produce a surface the renderer accepts as dark.
// Accent stays native Omarchy so brand identity is preserved.
/**
 * Synthesises a Dark `darkColors` half from a Light-mode Omarchy palette.
 * @param {Palette} c raw palette
 * @param {Hex} ac the accent
 * @param {Hex} acFg the on-accent foreground
 * @returns {ColorScale}
 */
export function synthDarkFromLight(c, ac, acFg) {
  const surface = mixHex(c.background, '#000000', SURFACE_MIX_AMOUNT)
  return {
    background: surface, foreground: '#e6e6e6',
    card:       mixHex(surface, '#ffffff', 0.04), cardForeground: '#e6e6e6',
    popover:    mixHex(surface, '#ffffff', 0.08), popoverForeground: '#e6e6e6',
    primary: ac, primaryForeground: acFg,
    secondary: mixHex(surface, '#ffffff', 0.06), secondaryForeground: '#e6e6e6',
    accent: ac, accentForeground: '#e6e6e6',
    muted:     mixHex(surface, '#ffffff', 0.06),
    mutedForeground: mixHex('#e6e6e6', surface, 0.45),
    border:    mixHex(surface, '#ffffff', 0.16),
    input:     mixHex(surface, '#ffffff', 0.10),
    ring: ac, midground: ac, composerRing: ac,
    destructive: c.red || '#e25563', destructiveForeground: '#ffffff',
    sidebarBackground: mixHex(surface, '#ffffff', 0.02),
    sidebarBorder:     mixHex(surface, '#ffffff', 0.16),
    userBubble:        mixHex(ac, surface, 0.18),
    userBubbleBorder:  mixHex(surface, '#ffffff', 0.16),
  }
}