/**
 * Omarchy Themes — Hermes-Desktop plugin (disk / unified-package mode).
 *
 *   • Fetches the parsed Omarchy themes from `GET /api/plugins/omarchy-themes/themes`
 *     and registers each one as a `THEMES_AREA` contribution so it shows up
 *     in the picker (a contribution to `THEMES_AREA` only *lists* a theme
 *     — applying it requires `requestTheme(name)`).
 *   • Adds a "Omarchy Themes" entry under Settings ▸ Plugins with a
 *     Browse sub-page (theme cards with Apply/Copy/Rescan) and an About
 *     sub-page (paths, refresh, troubleshooting).
 *   • Registers a ⌘K palette command per theme (capped at 30 to keep the
 *     picker usable; the Browse page carries the long list).
 *
 * Pure ESM, no JSX compilation: every UI element is a `jsx()` / `jsxs()`
 * call against `react/jsx-runtime`. Imports restricted to:
 *   `@hermes/plugin-sdk`, `react`, `react/jsx-runtime`
 *
 * The plugin inventories with `defaultEnabled: false` (opt-in) because
 * it ships a large number of theme contributions and an explicit toggle
 * avoids accidentally spamming the picker on first install.
 */

import { PALETTE_AREA, requestTheme, THEMES_AREA, useValue } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import { useEffect, useState } from 'react'

const ID = 'omarchy-themes'
const REST_TIMEOUT_MS = 10000
const PALETTE_COMMAND_LIMIT = 30

/** One theme as the backend returns it. */
function parseThemeEntry(raw) {
  const theme = raw && typeof raw === 'object' ? raw.theme : null
  if (!theme || typeof theme !== 'object') return null
  if (typeof theme.name !== 'string' || typeof theme.label !== 'string') return null
  return {
    slug: typeof raw.slug === 'string' ? raw.slug : theme.name,
    label: theme.label,
    mode: raw.mode === 'light' ? 'light' : 'dark',
    theme
  }
}

async function fetchThemes(ctx, { signal } = {}) {
  const data = await ctx.rest('/themes', {
    signal,
    timeout: REST_TIMEOUT_MS
  })
  const list = data && Array.isArray(data.themes) ? data.themes : []
  const parsed = []
  const seen = new Set()
  for (const entry of list) {
    const item = parseThemeEntry(entry)
    if (!item || seen.has(item.theme.name)) continue
    seen.add(item.theme.name)
    parsed.push(item)
  }
  return parsed
}

/* ────────────────────────────────────────────────────────────────────────
 * Settings sub-pages
 * ──────────────────────────────────────────────────────────────────────── */

function SwatchStrip({ theme }) {
  const colors = theme && theme.colors ? theme.colors : {}
  const term = theme && theme.terminal ? theme.terminal : {}
  const swatches = [
    { label: 'bg', value: colors.background },
    { label: 'fg', value: colors.foreground },
    { label: 'accent', value: colors.primary },
    { label: 'red', value: term.red },
    { label: 'green', value: term.green },
    { label: 'blue', value: term.blue },
    { label: 'yellow', value: term.yellow }
  ].filter(item => typeof item.value === 'string' && item.value.length > 0)

  return jsx('div', {
    className: 'omarchy-themes-swatch-strip',
    children: swatches.map((swatch, index) =>
      jsx('span', {
        className: 'omarchy-themes-swatch',
        title: `${swatch.label}: ${swatch.value}`,
        style: { background: swatch.value },
        'aria-label': `${swatch.label} ${swatch.value}`,
        children: ''
      }, `${swatch.label}-${index}`)
    )
  })
}

function ThemeCard({ entry, ctx }) {
  const [copied, setCopied] = useState(false)
  const name = entry.theme.name
  const label = entry.theme.label
  const description = entry.theme.description || `Omarchy theme · ${entry.mode}`
  const slug = entry.slug

  async function apply() {
    const accepted = requestTheme(name)
    if (!accepted && ctx.pet && ctx.pet.visible) {
      ctx.pet.say(`Theme ${label} is not installed`, { id: `omarchy-themes-missing-${slug}`, ttlMs: 4000 })
    }
  }

  async function copy() {
    const ok = await ctx.os.writeClipboard(name)
    if (ok) {
      setCopied(true)
      ctx.setTimeout(() => setCopied(false), 1500)
    }
  }

  return jsxs('div', {
    className: 'omarchy-themes-card',
    'data-theme-mode': entry.mode,
    children: [
      jsxs('div', { className: 'omarchy-themes-card-head', children: [
        jsx('span', { className: 'omarchy-themes-card-name', children: label }),
        jsx('span', {
          className: 'omarchy-themes-card-badge',
          'aria-label': `Mode ${entry.mode}`,
          children: entry.mode
        })
      ] }),
      jsx('div', { className: 'omarchy-themes-card-desc', children: description }),
      jsx(SwatchStrip, { theme: entry.theme }),
      jsxs('div', { className: 'omarchy-themes-card-actions', children: [
        jsx('button', {
          type: 'button',
          className: 'omarchy-themes-btn omarchy-themes-btn-primary',
          onClick: apply,
          children: 'Apply'
        }),
        jsx('button', {
          type: 'button',
          className: 'omarchy-themes-btn',
          onClick: copy,
          'aria-live': 'polite',
          children: copied ? 'Copied' : 'Copy name'
        })
      ] })
    ]
  })
}

function BrowsePage({ ctx }) {
  const [themes, setThemes] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function reload() {
    setBusy(true)
    setError(null)
    try {
      const list = await fetchThemes(ctx)
      setThemes(list)
    } catch (err) {
      setError(err && err.message ? err.message : String(err))
      setThemes([])
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void reload() }, [])

  if (error) {
    return jsxs('div', { className: 'omarchy-themes-pane', children: [
      jsx('div', { className: 'omarchy-themes-error', role: 'status', children:
        `Omarchy-Themes nicht verfügbar — ist das Backend aktiv? (${error})`
      }),
      jsx('button', {
        type: 'button',
        className: 'omarchy-themes-btn omarchy-themes-btn-primary',
        onClick: reload,
        children: busy ? 'Rescanning…' : 'Retry'
      })
    ] })
  }

  if (!themes.length && busy) {
    return jsx('div', { className: 'omarchy-themes-pane', role: 'status', children: 'Scanning themes…' })
  }

  if (!themes.length) {
    return jsxs('div', { className: 'omarchy-themes-pane', children: [
      jsx('div', { className: 'omarchy-themes-empty', children:
        'Keine Omarchy-Themes gefunden. Lege ein Verzeichnis mit `colors.toml` unter /usr/share/omarchy/themes oder ~/.config/omarchy/themes an.'
      }),
      jsx('button', {
        type: 'button',
        className: 'omarchy-themes-btn',
        onClick: reload,
        children: 'Rescan'
      })
    ] })
  }

  return jsxs('div', { className: 'omarchy-themes-pane', children: [
    jsxs('div', { className: 'omarchy-themes-toolbar', children: [
      jsx('span', { className: 'omarchy-themes-count', children: `${themes.length} theme${themes.length === 1 ? '' : 's'}` }),
      jsx('button', {
        type: 'button',
        className: 'omarchy-themes-btn',
        onClick: reload,
        disabled: busy,
        children: busy ? 'Rescanning…' : 'Rescan'
      })
    ] }),
    jsx('div', {
      className: 'omarchy-themes-grid',
      children: themes.map(entry => jsx(ThemeCard, { entry, ctx }, entry.slug))
    })
  ] })
}

function AboutPage({ ctx }) {
  const [rescanning, setRescanning] = useState(false)
  const [count, setCount] = useState(null)

  async function rescan() {
    setRescanning(true)
    try {
      const data = await ctx.rest('/rescan', { method: 'POST', timeout: REST_TIMEOUT_MS })
      setCount(typeof data.count === 'number' ? data.count : null)
    } catch {
      setCount(null)
    } finally {
      setRescanning(false)
    }
  }

  return jsxs('div', { className: 'omarchy-themes-pane', children: [
    jsx('p', { className: 'omarchy-themes-about', children:
      'Reads Omarchy theme directories and exposes every colors.toml as a Hermes-Desktop skin. Override the search paths with the OMARCHY_THEME_PATHS environment variable (comma-separated).'
    }),
    jsxs('ul', { className: 'omarchy-themes-paths', children: [
      jsx('li', { children: jsx('code', { children: '/usr/share/omarchy/themes' }) }),
      jsx('li', { children: jsx('code', { children: '~/.config/omarchy/themes' }) })
    ] }),
    jsxs('div', { className: 'omarchy-themes-actions', children: [
      jsx('button', {
        type: 'button',
        className: 'omarchy-themes-btn omarchy-themes-btn-primary',
        onClick: rescan,
        disabled: rescanning,
        children: rescanning ? 'Rescanning…' : 'Rescan now'
      }),
      typeof count === 'number' && jsx('span', {
        className: 'omarchy-themes-count',
        children: `Last rescan: ${count} theme${count === 1 ? '' : 's'}`
      })
    ] }),
    jsx('p', { className: 'omarchy-themes-hint', children:
      'Theme picker listings come from contributions registered via the THEMES_AREA surface; switching is a separate requestTheme() call.'
    })
  ] })
}

/* ────────────────────────────────────────────────────────────────────────
 * Styles — vars only, no hardcoded colors
 * ──────────────────────────────────────────────────────────────────────── */

const CSS = `
.omarchy-themes-pane{display:flex;flex-direction:column;gap:12px;padding:4px 0;color:var(--ui-text-primary)}
.omarchy-themes-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px}
.omarchy-themes-count{font-size:11px;color:var(--ui-text-tertiary)}
.omarchy-themes-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.omarchy-themes-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.omarchy-themes-card{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:8px;border:1px solid var(--ui-border);background:var(--ui-bg-elevated)}
.omarchy-themes-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.omarchy-themes-card-name{font-weight:600;color:var(--ui-text-primary)}
.omarchy-themes-card-badge{font-size:10px;line-height:14px;padding:0 6px;border-radius:4px;border:1px solid var(--ui-border);color:var(--ui-text-secondary);text-transform:uppercase;letter-spacing:.04em}
.omarchy-themes-card-desc{font-size:11px;line-height:15px;color:var(--ui-text-tertiary)}
.omarchy-themes-swatch-strip{display:flex;gap:2px;height:18px;border-radius:4px;overflow:hidden;border:1px solid var(--ui-border)}
.omarchy-themes-swatch{flex:1;min-width:0}
.omarchy-themes-card-actions{display:flex;gap:6px;margin-top:auto}
.omarchy-themes-btn{display:inline-flex;align-items:center;justify-content:center;height:24px;padding:0 10px;border-radius:4px;border:1px solid var(--ui-border);background:var(--ui-bg);color:var(--ui-text-primary);font-size:11px;cursor:pointer}
.omarchy-themes-btn:hover{background:var(--ui-bg-hover)}
.omarchy-themes-btn:disabled{opacity:.5;cursor:default}
.omarchy-themes-btn-primary{background:var(--ui-accent);color:var(--ui-accent-fg);border-color:transparent}
.omarchy-themes-btn-primary:hover{filter:brightness(1.05)}
.omarchy-themes-empty,.omarchy-themes-error{font-size:12px;line-height:17px;color:var(--ui-text-secondary);padding:8px 0}
.omarchy-themes-about{font-size:12px;line-height:17px;color:var(--ui-text-secondary);margin:0}
.omarchy-themes-paths{font-size:11px;color:var(--ui-text-tertiary);margin:0;padding-left:18px}
.omarchy-themes-paths code{font-family:var(--font-mono,monospace)}
.omarchy-themes-hint{font-size:11px;color:var(--ui-text-tertiary);margin:0}
`

/* ────────────────────────────────────────────────────────────────────────
 * Plugin default export
 * ──────────────────────────────────────────────────────────────────────── */

export default {
  id: ID,
  name: 'Omarchy Themes',
  description: 'Imports Omarchy theme directories as selectable Hermes-Desktop skins.',
  defaultEnabled: false,

  register(ctx) {
    // Inject the style once; the host cleans up via onDispose so reloads don't pile up.
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.append(style)
    ctx.onDispose(() => style.remove())

    // Settings page first so the user has a way to reach the theme UI even
    // before the async backend fetch lands. The Browse sub-page triggers
    // its own rescan on mount; the About page carries a manual rescan.
    const unregisterSettings = ctx.registerSettingsPage?.({
      id: 'browse',
      title: 'Omarchy Themes',
      icon: 'color-palette',
      order: 10,
      render: function Browse() {
        return jsx(BrowsePage, { ctx })
      },
      children: [
        {
          id: 'about',
          title: 'About',
          render: function About() {
            return jsx(AboutPage, { ctx })
          }
        }
      ]
    })

    // Fetch once, then register every theme as a THEMES_AREA contribution
    // and a (capped) palette row. The palette rows appear immediately on
    // ⌘K so the user can swap themes without opening Settings.
    let disposers = []
    ctx.onDispose(() => { disposers.forEach(d => d()); disposers = [] })

    fetchThemes(ctx)
      .then(themes => {
        // THEMES_AREA: each theme is one contribution; the host filters out
        // names that collide with built-ins (we add "-omarchy" on the
        // backend for those). Ordering keeps the picker list stable.
        for (const entry of themes) {
          disposers.push(ctx.register({
            id: `theme-${entry.slug}`,
            area: THEMES_AREA,
            data: entry.theme,
            title: entry.theme.label,
            order: 100
          }))
        }

        // Cmd-K palette: one "Apply Omarchy Theme: <label>" per theme,
        // capped so a hundred stock themes don't bury everything else.
        for (const entry of themes.slice(0, PALETTE_COMMAND_LIMIT)) {
          const name = entry.theme.name
          const label = entry.theme.label
          disposers.push(ctx.register({
            id: `apply-${entry.slug}`,
            area: PALETTE_AREA,
            title: `Apply Omarchy Theme: ${label}`,
            data: {
              id: `apply-${entry.slug}`,
              label: `Apply Omarchy Theme: ${label}`,
              keywords: ['theme', 'omarchy', 'skin', 'apply', label.toLowerCase()],
              detail: () => name,
              detailVariant: 'muted',
              run: () => requestTheme(name)
            }
          }))
        }
      })
      .catch(error => {
        // Surface the failure once via the pet bubble if available, then
        // leave a Settings-page banner; the user can retry from Browse.
        if (ctx.pet && ctx.pet.visible) {
          ctx.pet.say('Omarchy-Themes nicht verfügbar — Backend aus?', { id: 'omarchy-themes-startup-error', ttlMs: 6000 })
        }
        logLoadFailure(ctx, error)
      })

    if (unregisterSettings) disposers.push(unregisterSettings)
  }
}

function logLoadFailure(ctx, error) {
  // The host surfaces plugin load failures through its own diagnostics; we
  // log here so `hermes logs gui` shows the cause when a user debugs.
  try { console.warn('[omarchy-themes] initial fetch failed:', error) } catch {}
}