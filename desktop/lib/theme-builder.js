// @ts-check
// Type-checked by `make typecheck` (tsc --allowJs --checkJs --noEmit). NOT
// compiled — Hermes Desktop loads this file as plain ESM at runtime; the
// typedefs and JSDoc are consumed only by tsc. Shared shapes live in
// ../types.d.ts.
/**
 * theme-builder.js — maps one raw Omarchy colors object to a DesktopTheme.
 *
 * No state, no side effects, no I/O. All pure functions.
 *
 * Depends on `./colors.js` for palette synthesis helpers, typography and
 * the two tuning constants. The four private helpers below factor the
 * previous monolithic buildTheme body (see t_a0c70813); this file collects
 * the full theme-building logic in one place so plugin.js only needs to
 * call buildTheme() and pass through its result.
 *
 * Exports:
 *   buildTheme(slug, c, taken)  — Maps an Omarchy raw colors object to
 *                                  { slug, label, mode, theme }. Returns null
 *                                  when mandatory fields (background/foreground/
 *                                  accent) are missing.
 *   toName(slug, taken)         — Derives the desktop theme name with the
 *                                  `omarchy-` prefix; deduplicates if needed.
 *   slugToLabel(slug)           — Title-cases a kebab/snake slug.
 *
 * Pure ESM, no build step.
 */
/** @typedef {import('../types').ColorScale} ColorScale */
/** @typedef {import('../types').Hex} Hex */
/** @typedef {import('../types').Mode} Mode */
/** @typedef {import('../types').Palette} Palette */
/** @typedef {import('../types').ThemeEntry} ThemeEntry */
/** @typedef {import('../types').TerminalPalette} TerminalPalette */
/**
 * Map of hex strings ("#rrggbb" lowercase) keyed by the matching TerminalPalette
 * field name; consumed by terminalPalette. Built inline rather than a new
 * type because it stays local.
 * @typedef {Record<string, string>} TerminalFieldMap
 */
import {
  modeOf, onAccent, mixHex,
  synthLightFromDark, synthDarkFromLight,
  DEFAULT_TYPOGRAPHY,
} from './colors.js'

// ---------------------------------------------------------------------------
// buildTheme private helpers
// ---------------------------------------------------------------------------

// Surfaces painted in the page colour are invisible. Omarchy derives
// lighter_background == background when a theme gives no shade (aetheria,
// ayaka, cpunk, last-horizon, solitude), and some themes set dark_background
// == background (hermarchy, omacarchy), which flattens sidebar and borders.
// Lift them off the page, toward the foreground (dark) or black (light) like
// the stock palettes do. A palette with neither shade gets a stronger fan-out.
/**
 * Lifts `lighter_background` and `dark_background` off the page when they
 * match `background`; otherwise returns the palette's own shades.
 * @param {Palette} c
 * @returns {{ lighterBg: string, darkBg: string }}
 */
function liftFlatSurfaces(c) {
  const bg = c.background, fg = c.foreground
  let lighterBg = c.lighter_background || bg
  let darkBg    = c.dark_background    || bg
  const light = modeOf(c) === 'light'
  const pole  = light ? '#000000' : fg
  const fullyFlat = lighterBg === bg && darkBg === bg
  if (lighterBg === bg) lighterBg = mixHex(bg, pole, light ? 0.04 : 0.08)
  if (darkBg === bg)    darkBg    = mixHex(bg, pole, fullyFlat ? (light ? 0.12 : 0.14) : 0.08)
  return { lighterBg, darkBg }
}

// Native palette = the mode Omarchy ships for this theme. Caller (buildTheme)
// assigns the returned object to `colors` when mode === 'light' or to
// `darkColors` when mode === 'dark'; the opposite slot is synthesized.
/**
 * Builds the native palette object (the mode Omarchy ships for this theme).
 * `buildTheme` assigns the returned object to `colors` (light) or
 * `darkColors` (dark); the opposite slot is built via synthLightFromDark /
 * synthDarkFromLight.
 * @param {Palette} c raw palette
 * @param {Hex} lighterBg
 * @param {Hex} darkBg
 * @param {Hex} ac the accent (resolved at the call site)
 * @param {Hex} acFg the on-accent foreground
 * @param {Hex} fg the foreground
 * @param {Hex} darkFg the dark-mode foreground fallback
 * @returns {ColorScale}
 */
function nativePalette(c, lighterBg, darkBg, ac, acFg, fg, darkFg) {
  return {
    background: c.background, foreground: fg,
    card: lighterBg, cardForeground: fg,
    popover: lighterBg, popoverForeground: fg,
    primary: ac, primaryForeground: acFg,
    secondary: lighterBg, secondaryForeground: fg,
    accent: ac, accentForeground: acFg,
    muted: c.muted || darkBg, mutedForeground: darkFg,
    border: darkBg, input: darkBg,
    ring: ac, midground: ac, composerRing: ac,
    destructive: c.red || '#ef4444', destructiveForeground: '#ffffff',
    sidebarBackground: darkBg, sidebarBorder: darkBg,
    userBubble: lighterBg, userBubbleBorder: darkBg,
  }
}

// Native terminal palette — bright_* fall back to non-bright. Returned under
// the `darkTerminal` key because the native terminal IS the dark terminal
// for Omarchy themes (the renderer in light mode paints the dark terminal
// against a light surface).
/**
 * Builds the native dark-terminal palette (bright_* falls back to non-bright).
 * Returned under the `darkTerminal` key — the native terminal IS the dark
 * terminal for Omarchy themes, and the renderer paints it against the
 * light surface in light mode.
 * @param {Palette} c raw palette
 * @param {Hex} fg the foreground
 * @param {Hex} darkBg the dark background fallback
 * @returns {{ darkTerminal: TerminalPalette }}
 */
function terminalPalette(c, fg, darkBg) {
  const bg = c.background, ac = c.accent
  return { darkTerminal: {
    foreground: fg, cursor: fg,
    selectionBackground: c.selection || darkBg,
    black: bg,
    red:     c.red     || fg,  green:   c.green   || fg,
    yellow:  c.yellow  || fg,  blue:    c.blue    || ac,
    magenta: c.magenta || ac,  cyan:    c.cyan    || ac,
    white:   c.bright_foreground || fg,
    brightBlack:   bg,
    brightRed:     c.bright_red     || c.red     || fg,
    brightGreen:   c.bright_green   || c.green   || fg,
    brightYellow:  c.bright_yellow  || c.yellow  || fg,
    brightBlue:    c.bright_blue    || c.blue    || ac,
    brightMagenta: c.bright_magenta || c.magenta || ac,
    brightCyan:    c.bright_cyan    || c.cyan    || ac,
    brightWhite:   fg,
  } }
}

// Light terminal = bright variant of the dark terminal (swap fg/black,
// keep ANSI colors). This way the ANSI palette stays readable on whichever
// surface the pane lands on.
/**
 * Light variant of the dark terminal — swap foreground and bright-foreground
 * to the palette's `bright_foreground`, swap black and bright-black to
 * `lighter_background`. The ANSI palette is preserved unchanged so it
 * stays readable on either surface.
 * @param {Palette} c raw palette
 * @param {TerminalPalette} terminal the dark-terminal palette
 * @param {Hex} bg fallback background hex (used when `lighter_background` is absent)
 * @param {Hex} fg fallback foreground hex
 * @returns {TerminalPalette}
 */
function lightTerminalFor(c, terminal, bg, fg) {
  return Object.assign({}, terminal, {
    foreground: c.bright_foreground || fg,
    cursor:     c.bright_foreground || fg,
    black:      c.lighter_background || bg,
    brightBlack: c.lighter_background || bg,
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Map one raw colors object to a DesktopTheme entry.
//
// Split into four private helpers; buildTheme() is pure orchestration:
//   1. liftFlatSurfaces(c)              → { lighterBg, darkBg }
//   2. nativePalette(c, lighterBg,      → the native palette object;
//      darkBg, ac, acFg, fg, darkFg)      fills the matching colors/darkColors
//                                          slot for the theme's native mode
//   3. terminalPalette(c, fg, darkBg)   → { darkTerminal }; nativeTerminal
//   4. lightTerminalFor(c, terminal,    → the light terminal (bright-fg
//      bg, fg)                            variant of the dark terminal)
/**
 * Maps an Omarchy raw colors object to a `ThemeEntry`
 * `{ slug, label, mode, theme }`. Both `colors` and `darkColors` (and the
 * matching terminals) are always populated so the renderer's
 * `getBaseColors()` never falls back to a synth — a dark Omarchy theme
 * applied in a light UI paints with a real light variant.
 * @param {string} slug theme slug (e.g. "tokyo-night")
 * @param {Palette} c parsed raw palette
 * @param {Set<string>} taken desktop theme names already used; the helper
 *   adds the result via `toName` semantics so callers can avoid collisions.
 * @returns {ThemeEntry | null} null when mandatory keys are missing
 */
export function buildTheme(slug, c, taken) {
  const bg = c.background, fg = c.foreground, ac = c.accent
  if (!bg || !fg || !ac) return null

  const { lighterBg, darkBg } = liftFlatSurfaces(c)
  const darkFg = c.dark_foreground || fg
  const mode   = modeOf(c)
  const name   = toName(slug, taken)
  const label  = slugToLabel(slug)
  const acFg   = onAccent(ac)

  // Native palette = the mode Omarchy ships for this theme.
  const native = nativePalette(c, lighterBg, darkBg, ac, acFg, fg, darkFg)

  // Native terminal palette — bright_* fall back to non-bright.
  const { darkTerminal } = terminalPalette(c, fg, darkBg)

  // ── Light / Dark palette pair ───────────────────────────────────────────
  // `colors` is the Light palette (Hermes Desktop convention), `darkColors`
  // is the Dark palette. Both are always populated so the renderer's
  // getBaseColors() never falls back to synth — a dark-mode Omarchy theme
  // applied in a light UI paints with a real light variant instead of the
  // existing light default, and vice versa.
  const lightColors = mode === 'light' ? native : synthLightFromDark(c, ac, acFg)
  const darkColors  = mode === 'dark'  ? native : synthDarkFromLight(c, ac, acFg)
  const lightTerminal = lightTerminalFor(c, darkTerminal, bg, fg)

  const theme = {
    name,
    label: 'Omarchy ' + label,
    description: 'Omarchy \u00b7 ' + label + ' \u00b7 ' + mode,
    colors: lightColors,
    darkColors: darkColors,
    terminal: lightTerminal,
    darkTerminal: darkTerminal,
    typography: DEFAULT_TYPOGRAPHY,
  }

  return { slug, label, mode, theme }
}

// Built-in slugs are filtered out upstream (THEMES.flatMap below — Source of
// Truth), so `slug` here is always a unique Omarchy palette and never collides
// with a built-in name. The desktop name gets an `omarchy-` prefix on purpose:
// Hermes registers every CLI skin under the bare slug as a backend theme, and a
// backend theme of the same name would shadow this entry in resolveTheme().
/**
 * Derives the desktop theme name: `omarchy-<slug>`, with `-dup` suffixes
 * appended when the name is already in `taken`. The prefix avoids collisions
 * with backend (CLI) themes that share the bare slug.
 * @param {string} slug raw Omarchy slug
 * @param {Set<string>} taken already-used desktop names
 * @returns {string}
 */
export function toName(slug, taken) {
  let name = 'omarchy-' + slug
  while (taken.has(name)) name = name + '-dup'
  return name
}

/**
 * Title-cases a kebab- or snake-case slug: "tokyo-night" → "Tokyo Night".
 * @param {string} slug
 * @returns {string}
 */
export function slugToLabel(slug) {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}