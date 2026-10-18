// @ts-check
// Type-checked by `make typecheck` (tsc --allowJs --checkJs --noEmit). NOT
// compiled — Hermes Desktop loads this file as plain ESM at runtime; the
// typedefs and JSDoc are consumed only by tsc. Shared shapes live in
// ./types.d.ts.
// React UI for the settings page. Extracted from plugin.js so the data
// pipeline (RAW parsing, theme building, registration) and the presentation
// (filter, swatches, theme cards) can evolve independently. Behaviour is
// identical to the previous inline block — only the file boundary moved.
//
// The repo has no JSX transform (`node --check` parses files as plain ESM),
// so the file uses React.createElement-equivalent calls from `react/jsx-runtime`
// — even though the extension is `.js` rather than `.jsx`, the source is the
// same JSX-via-runtime style as plugin.js. Mirrors plugin.js's pattern.
//
// `themes` is injected by the caller (plugin.js holds the module-local
// `THEMES` constant built from the baked RAW table) — keeps the component
// independent of the data pipeline while staying explicit about its input.
/** @typedef {import('./types').Hex} Hex */
/** @typedef {import('./types').Mode} Mode */
/** @typedef {import('./types').PluginContext} PluginContext */
/** @typedef {import('./types').ThemeEntry} ThemeEntry */
import { useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { useTheme, Button, EmptyState, requestTheme } from '@hermes/plugin-sdk'

const SWATCH_KEYS = /** @type {readonly (keyof import('./types').ColorScale)[]} */ (
  ['background', 'accent', 'foreground', 'red', 'green', 'cyan']
)

/**
 * Single colour swatch chip rendered in a theme card.
 * @param {{ color: Hex }} props
 */
function Swatch({ color }) {
  return jsx('span', {
    title: color,
    style: {
      display: 'inline-block', width: '14px', height: '14px',
      borderRadius: '3px', background: color,
      border: '1px solid rgba(128,128,128,.25)', flexShrink: 0,
    }
  })
}

/**
 * Theme card with swatches and Apply / Copy-name buttons. The Apply button
 * applies the palette AND forces the UI into the mode the palette was
 * designed for (Theme-Mode-Sync).
 * @param {{ entry: ThemeEntry, ctx: PluginContext }} props
 */
function ThemeCard({ entry, ctx }) {
  // Theme-Mode-Sync: pulling setMode out of the React context means the Apply
  // button is now a one-stop shop — it applies the palette AND forces the UI
  // into the mode the palette was designed for. Without this, applying a
  // Light Omarchy theme (lupine, white, …) in a Hermes-Desktop dark context
  // paints the dark variant (#1e1e1e) instead of the light one (#fafafa).
  const { setMode } = useTheme()
  const swatches = SWATCH_KEYS.map(k => /** @type {Hex} */ (entry.theme.colors[k])).filter(Boolean)
  return jsxs('div', {
    style: {
      padding: '10px 12px', borderRadius: '8px',
      border: '1px solid var(--ui-border)',
      display: 'flex', flexDirection: 'column', gap: '6px',
    },
    children: [
      jsxs('div', {
        style: { display: 'flex', alignItems: 'center', gap: '6px' },
        children: [
          jsx('span', { style: { fontWeight: 500, fontSize: '13px', flex: 1, color: 'var(--ui-text-primary)' }, children: entry.label }),
          jsx('span', {
            style: { fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: 'var(--ui-muted)', color: 'var(--ui-text-secondary)' },
            children: entry.mode,
          }),
        ]
      }),
      jsx('div', { style: { display: 'flex', gap: '4px' }, children: swatches.map(c => jsx(Swatch, { color: c }, c)) }),
      jsxs('div', {
        style: { display: 'flex', gap: '6px', marginTop: '2px' },
        children: [
          jsx(Button, {
            size: 'sm',
            onClick: () => {
              requestTheme(entry.theme.name)
              setMode(entry.mode)  // entry.mode ∈ {'light','dark'} ⊂ ThemeMode
            },
            children: 'Apply'
          }),
          jsx(Button, { size: 'sm', variant: 'ghost', onClick: () => ctx.os?.writeClipboard(entry.theme.name), children: 'Copy name' }),
        ]
      })
    ]
  })
}

/**
 * Browse page root — filter input + grid of theme cards (or an empty state).
 * @param {{ ctx: PluginContext, themes: ThemeEntry[] }} props
 */
export function BrowsePage({ ctx, themes }) {
  const [filter, setFilter] = useState('')
  const q = filter.trim().toLowerCase()
  /** @param {ThemeEntry} t */
  const visible = q
    ? themes.filter(t => t.label.toLowerCase().includes(q) || t.slug.includes(q) || t.mode === q)
    : themes

  return jsxs('div', {
    style: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' },
    children: [
      jsx('input', {
        placeholder: 'Filter\u2026',
        value: filter,
        onChange: /** @param {{ target: { value: string } }} e */ e => setFilter(e.target.value),
        style: {
          padding: '6px 10px', borderRadius: '6px',
          border: '1px solid var(--ui-border)',
          background: 'var(--ui-input)', color: 'var(--ui-text-primary)',
          fontSize: '13px', outline: 'none',
        }
      }),
      visible.length === 0
        ? jsx(EmptyState, { title: 'No matching themes' })
        : jsx('div', {
            style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: '10px' },
            children: visible.map(t => jsx(ThemeCard, { entry: t, ctx }, t.slug))
          })
    ]
  })
}