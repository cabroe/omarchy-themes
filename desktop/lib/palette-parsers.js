// @ts-check
// Type-checked by `make typecheck` (tsc --allowJs --checkJs --noEmit). NOT
// compiled — Hermes Desktop loads this file as plain ESM at runtime; the
// typedefs and JSDoc are consumed only by tsc. Shared shapes live in
// ../types.d.ts.
/**
 * palette-parsers.js — parse Omarchy file formats into palette objects.
 *
 * No state, no side effects beyond reading `text` arguments. All pure
 * functions.
 *
 * Exports:
 *   paletteFromToml(text)  — Parses Omarchy's colors.toml via the
 *                             state-based tokenizer. Returns a palette `c`
 *                             object (same shape as RAW[*].c) ready for
 *                             buildTheme(), or null when mandatory keys are
 *                             absent.
 *   displaySkin(yaml)      — Reads `display.skin` from a Hermes config.yaml
 *                             (the plugin keeps a minimal hand-rolled parser
 *                             to avoid any yaml dependency). Returns the
 *                             skin slug string or null.
 *   themeName(text)        — Normalises Omarchy's current/theme.name file
 *                             content to a slug. Returns null for empty input.
 *
 * paletteFromToml uses tokenizeToml + parseTomlLine (see inline docs).
 * The state machine description is in the Wave-2 commit for t_8a8867c7.
 *
 * Pure ESM, no build step.
 */
/** @typedef {import('../types').Mode} Mode */
/** @typedef {import('../types').Palette} Palette */
import { luma } from './colors.js'

// ---------------------------------------------------------------------------
// paletteFromToml
// ---------------------------------------------------------------------------

// Omarchy's colors.toml: accent/foreground/background plus color0..15, and
// sometimes named ANSI colors, shades or `mode`. Same mapping as the generator
// (red=color1 … cyan=color6, bright_*=color9..14); the mode falls back to the
// background's brightness.
//
// Parsing is delegated to a state-based mini-tokenizer (`tokenizeToml`) so
// future Omarchy palette syntaxes do not require rewriting the regex:
// multi-line strings, inline tables, and array values are skipped silently
// while every `key = value` line still feeds the palette mapping.
/**
 * Parse an Omarchy colors.toml blob into a `Palette`-shaped object.
 * `tokenizeToml` does the heavy lifting (state-based 3-step tokenizer);
 * this function maps the resulting `t` to the canonical palette shape.
 * Returns null when mandatory keys (background/foreground/accent) are absent.
 * @param {string} text raw colors.toml contents
 * @returns {Palette | null}
 */
export function paletteFromToml(text) {
  const t = tokenizeToml(text)
  const accent = t.accent ?? t.color4
  if (!t.background || !t.foreground || !accent) return null
  const c = {
    mode: t.mode ?? (luma(t.background) > 0.5 ? 'light' : 'dark'),
    accent, background: t.background, foreground: t.foreground,
    selection: t.selection ?? t.selection_background, muted: t.muted ?? t.color8, dark_foreground: t.dark_foreground ?? t.color8,
    dark_background: t.dark_background, darker_background: t.darker_background, lighter_background: t.lighter_background,
    bright_foreground: t.bright_foreground,
  }
  // Build the dynamic ANSI colours (red/green/yellow/blue/magenta/cyan and
  // their bright_* variants). The Palette interface can't enumerate them via
  // string-indexing, so we use a Record accumulator + spread merge below.
  /** @type {Record<string, string | undefined>} */
  const ansi = {}
  ;['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'].forEach((n, i) => {
    ansi[n] = t[n] ?? t['color' + (i + 1)]
    ansi['bright_' + n] = t['bright_' + n] ?? t['color' + (i + 9)]
  })
  return { ...c, ...ansi }
}

// State-based mini-TOML tokenizer for Omarchy's colors.toml. Each line is
// scanned character by character with three states:
//   KEY     — accumulate until the first `=` (a `#` before `=` is malformed,
//             ignored).
//   VALUE   — accumulate until end-of-line or an unquoted `#`. Track quote
//             state so a `#` inside a quoted value survives. A bare `#`
//             starts a comment only AFTER at least one value character has
//             been consumed — that way `key = #abc` is not mistaken for a
//             comment the moment the leading `#` is reached.
//   COMMENT — dropped.
//
// Per-value normalisation: a single pair of surrounding quotes (`'` or `"`)
// is stripped; the value is lowercased; 3-digit hex (`#abc`) is expanded to
// 6-digit lowercase (`#aabbcc`). Unknown keys are still recorded so callers
// can extend the mapping; lines that do not match `key = value` (section
// headers, multi-line strings, array values, inline tables) are silently
// skipped.
/**
 * Token-map returned by `tokenizeToml` — every key is a raw lowercase value
 * after quote-stripping + 3-digit-hex expansion; the canonical palette
 * mapping (Palette) is built from this in `paletteFromToml`.
 * @typedef {{ [key: string]: string | undefined }} TokenMap
 */
/**
 * Tokenize an Omarchy colors.toml blob into a flat key→lowercase-value
 * map. Unknown keys are kept (callers extend the mapping); non-`key =
 * value` lines (section headers, arrays, inline tables, multi-line
 * strings) are silently skipped. Runs quote-stripping, lowercase and
 * 3-digit-hex expansion per value.
 * @param {string} text raw toml
 * @returns {TokenMap}
 */
function tokenizeToml(text) {
  /** @type {TokenMap} */
  const out = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const pair = parseTomlLine(rawLine)
    if (!pair) continue
    let [key, value] = pair
    // Strip a single pair of surrounding quotes (' or ").
    if (value.length >= 2) {
      const f = value[0], l = value[value.length - 1]
      if ((f === '"' || f === "'") && f === l) value = value.slice(1, -1)
    }
    value = value.toLowerCase()
    // Expand 3-digit hex to 6-digit lowercase (#abc → #aabbcc).
    const m = value.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/)
    if (m) value = '#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]
    out[key] = value
  }
  return out
}

/**
 * Parse one TOML line and return its [key, value] pair (both strings) or
 * `null` for blank / whole-line-comment / malformed lines.
 * @param {string} line
 * @returns {[string, string] | null}
 */
function parseTomlLine(line) {
  let i = 0
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++
  // Whole-line comment or blank line.
  if (i >= line.length || line[i] === '#') return null
  // STATE: KEY — accumulate until '=' or '#'.
  const keyStart = i
  while (i < line.length && line[i] !== '=' && line[i] !== '#') i++
  if (line[i] !== '=') return null
  const key = line.slice(keyStart, i).trim()
  i++ // past '='
  // STATE: VALUE — accumulate until end-of-line or an unquoted '#'. Track
  // quote state so a '#' inside the value survives; an unclosed quote stays
  // open to end-of-line (the value runs to the end — better to surface a
  // malformed value than to silently truncate).
  const valueStart = i
  let quote = null
  let valueChars = 0
  while (i < line.length) {
    const ch = line[i]
    if (quote) {
      if (ch === quote) quote = null
      i++
      valueChars++
    } else if (ch === '"' || ch === "'") {
      quote = ch
      i++
      valueChars++
    } else if (ch === '#' && valueChars > 0) {
      // STATE: COMMENT — drop the rest of the line.
      break
    } else if (ch === ' ' || ch === '\t') {
      i++ // whitespace does not count toward valueChars
    } else {
      i++
      valueChars++
    }
  }
  const value = line.slice(valueStart, i).trim()
  return key ? [key, value] : null
}

// ---------------------------------------------------------------------------
// displaySkin
// ---------------------------------------------------------------------------

// `display.skin` from a Hermes config.yaml — only the direct child of the
// top-level `display:` block, quotes and trailing comments stripped.
/**
 * Reads `display.skin` from a Hermes config.yaml — only the direct child of
 * the top-level `display:` block, with optional surrounding quotes and
 * trailing `# ...` comments stripped. The plugin keeps this hand-rolled
 * parser to avoid pulling a yaml dependency.
 * @param {string} yaml raw config.yaml text
 * @returns {string | null} the skin slug, or null when not present
 */
export function displaySkin(yaml) {
  let inDisplay = false
  let childIndent = null
  for (const line of yaml.split('\n')) {
    if (!line.trim() || /^\s*#/.test(line)) continue
    if (/^\S/.test(line)) {
      inDisplay = /^display:\s*(#.*)?$/.test(line)
      childIndent = null
      continue
    }
    if (!inDisplay) continue
    const indent = (line.match(/^ */)?.[0] ?? '').length
    childIndent ??= indent
    if (indent !== childIndent) continue
    const m = line.match(/^ +skin:\s*(['"]?)([^'"#\s]+)\1\s*(#.*)?$/)
    if (m) return m[2]
  }
  return null
}

// ---------------------------------------------------------------------------
// themeName
// ---------------------------------------------------------------------------

// Omarchy's `current/theme.name`: the theme slug as given to `omarchy theme set`
// ("Tokyo Night" → tokyo-night, like the theme dir names).
/**
 * Normalises Omarchy's `current/theme.name` content to a slug ("Tokyo Night"
 * → "tokyo-night", matching the theme dir names). Returns null for empty
 * or whitespace-only input.
 * @param {string} text raw theme.name file content
 * @returns {string | null}
 */
export function themeName(text) {
  const name = text.trim().toLowerCase().replace(/\s+/g, '-')
  return name || null
}