/**
 * omarchy-themes — pure local Hermes-Desktop plugin.
 *
 * No backend, no HTTP calls. The Omarchy palettes are baked into the RAW
 * table below (generated from /usr/share/omarchy/themes/<slug>/colors.toml).
 *
 * To update after an Omarchy upgrade:
 *   scripts/generate-themes.py --remote omarchy && scripts/deploy.sh
 */
import {
  THEMES_AREA, PALETTE_AREA,
  requestTheme,
  Button, EmptyState,
} from '@hermes/plugin-sdk'
import { useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

// ---------------------------------------------------------------------------
// Built-in Hermes theme names — suffix collisions with -omarchy
// ---------------------------------------------------------------------------
const BUILTIN_NAMES = new Set([
  'github', 'nous', 'nous-alt', 'catppuccin', 'everforest', 'solarized',
  'classic', 'midnight', 'ember', 'mono', 'cyberpunk', 'slate',
])

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------
function luma(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function onAccent(accent) { return luma(accent) < 0.55 ? '#ffffff' : '#000000' }

function slugToLabel(slug) {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function toName(slug, taken) {
  let name = BUILTIN_NAMES.has(slug) ? slug + '-omarchy' : slug
  while (taken.has(name)) name = name + '-dup'
  return name
}

// ---------------------------------------------------------------------------
// Map one raw colors object to a DesktopTheme entry
// ---------------------------------------------------------------------------
function buildTheme(slug, c, taken) {
  const bg = c.background, fg = c.foreground, ac = c.accent
  if (!bg || !fg || !ac) return null

  const lighterBg = c.lighter_background || bg
  const darkBg    = c.dark_background    || bg
  const darkFg    = c.dark_foreground    || fg
  const mode      = (c.mode || 'dark').toLowerCase() === 'light' ? 'light' : 'dark'
  const name      = toName(slug, taken)
  const label     = slugToLabel(slug)
  const acFg      = onAccent(ac)

  const colors = {
    background: bg, foreground: fg,
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

  const terminal = {
    foreground: fg, cursor: fg,
    selectionBackground: c.selection || darkBg,
    black: bg,
    red:     c.red     || fg,  green:   c.green   || fg,
    yellow:  c.yellow  || fg,  blue:    c.blue     || ac,
    magenta: c.magenta || ac,  cyan:    c.cyan     || ac,
    white:   c.bright_foreground || fg,
    brightBlack:   bg,
    brightRed:     c.bright_red     || c.red     || fg,
    brightGreen:   c.bright_green   || c.green   || fg,
    brightYellow:  c.bright_yellow  || c.yellow  || fg,
    brightBlue:    c.bright_blue    || c.blue    || ac,
    brightMagenta: c.bright_magenta || c.magenta || ac,
    brightCyan:    c.bright_cyan    || c.cyan    || ac,
    brightWhite:   fg,
  }

  const theme = { name, label, description: 'Omarchy \u00b7 ' + label + ' \u00b7 ' + mode, colors, terminal }

  if (mode === 'light') {
    theme.darkColors = Object.assign({}, colors, {
      background: c.dark_background   || '#1e1e2e',
      card:       c.darker_background || '#313244',
      popover:    c.darker_background || '#313244',
      border:     c.darker_background || darkBg,
      input:      c.darker_background || darkBg,
      sidebarBackground: c.darker_background || darkBg,
    })
    theme.darkTerminal = terminal
  }

  return { slug, label, mode, theme }
}

// ---------------------------------------------------------------------------
// Baked-in palettes
// ---------------------------------------------------------------------------
// BEGIN GENERATED THEMES — do not edit by hand, run scripts/generate-themes.py
// 25 themes from /usr/share/omarchy/themes, ~/.config/omarchy/themes
const RAW = [
  { slug:'catppuccin',       c:{ mode:'dark',  accent:'#89b4fa', selection:'#45475a', muted:'#585b70', background:'#1e1e2e', dark_background:'#161622', darker_background:'#101019', lighter_background:'#313244', foreground:'#cdd6f4', dark_foreground:'#6c7086', bright_foreground:'#cdd6f4', red:'#f38ba8', yellow:'#f9e2af', green:'#a6e3a1', cyan:'#94e2d5', blue:'#89b4fa', magenta:'#f5c2e7', bright_red:'#f38ba8', bright_yellow:'#f9e2af', bright_green:'#a6e3a1', bright_cyan:'#94e2d5', bright_blue:'#89b4fa', bright_magenta:'#f5c2e7' } },
  { slug:'catppuccin-latte', c:{ mode:'light', accent:'#1e66f5', selection:'#ccd0da', muted:'#acb0be', background:'#eff1f5', dark_background:'#e3e4e8', darker_background:'#d7d8dc', lighter_background:'#dce0e8', foreground:'#4c4f69', dark_foreground:'#9ca0b0', bright_foreground:'#4c4f69', red:'#d20f39', yellow:'#df8e1d', green:'#40a02b', cyan:'#179299', blue:'#1e66f5', magenta:'#ea76cb', bright_red:'#d20f39', bright_yellow:'#df8e1d', bright_green:'#40a02b', bright_cyan:'#179299', bright_blue:'#1e66f5', bright_magenta:'#ea76cb' } },
  { slug:'ethereal',         c:{ mode:'dark',  accent:'#7d82d9', selection:'#252e56', muted:'#6d7db6', background:'#060b1e', dark_background:'#040816', darker_background:'#030610', lighter_background:'#131a3a', foreground:'#ffcead', dark_foreground:'#6d7db6', bright_foreground:'#ffcead', red:'#ed5b5a', yellow:'#e9bb4f', green:'#92a593', cyan:'#a3bfd1', blue:'#7d82d9', magenta:'#c89dc1', bright_red:'#faaaa9', bright_yellow:'#f7dc9c', bright_green:'#c4cfc4', bright_cyan:'#dfeaf0', bright_blue:'#c2c4f0', bright_magenta:'#ead7e7' } },
  { slug:'everforest',       c:{ mode:'dark',  accent:'#7fbbb3', selection:'#3d484d', muted:'#475258', background:'#2d353b', dark_background:'#21272c', darker_background:'#181d20', lighter_background:'#343f44', foreground:'#d3c6aa', dark_foreground:'#4f585e', bright_foreground:'#d3c6aa', red:'#e67e80', yellow:'#dbbc7f', green:'#a7c080', cyan:'#83c092', blue:'#7fbbb3', magenta:'#d699b6', bright_red:'#e67e80', bright_yellow:'#dbbc7f', bright_green:'#a7c080', bright_cyan:'#83c092', bright_blue:'#7fbbb3', bright_magenta:'#d699b6' } },
  { slug:'flexoki-light',    c:{ mode:'light', accent:'#205ea6', selection:'#cecdc3', muted:'#b7b5ac', background:'#fffcf0', dark_background:'#f2efe4', darker_background:'#e5e2d8', lighter_background:'#e6e4d9', foreground:'#100f0f', dark_foreground:'#878580', bright_foreground:'#100f0f', red:'#d14d41', yellow:'#d0a215', green:'#879a39', cyan:'#3aa99f', blue:'#205ea6', magenta:'#ce5d97', bright_red:'#d14d41', bright_yellow:'#d0a215', bright_green:'#879a39', bright_cyan:'#3aa99f', bright_blue:'#4385be', bright_magenta:'#ce5d97' } },
  { slug:'gruvbox',          c:{ mode:'dark',  accent:'#7daea3', selection:'#504945', muted:'#665c54', background:'#282828', dark_background:'#1e1e1e', darker_background:'#161616', lighter_background:'#3c3836', foreground:'#d4be98', dark_foreground:'#7c6f64', bright_foreground:'#d4be98', red:'#ea6962', yellow:'#d8a657', green:'#a9b665', cyan:'#89b482', blue:'#7daea3', magenta:'#d3869b', bright_red:'#ea6962', bright_yellow:'#d8a657', bright_green:'#a9b665', bright_cyan:'#89b482', bright_blue:'#7daea3', bright_magenta:'#d3869b' } },
  { slug:'hackerman',        c:{ mode:'dark',  accent:'#82fb9c', selection:'#1f253a', muted:'#2d3450', background:'#0b0c16', dark_background:'#080910', darker_background:'#06060c', lighter_background:'#151828', foreground:'#ddf7ff', dark_foreground:'#6a6e95', bright_foreground:'#ddf7ff', red:'#50f872', yellow:'#50f7d4', green:'#4fe88f', cyan:'#7cf8f7', blue:'#829dd4', magenta:'#86a7df', bright_red:'#85ff9d', bright_yellow:'#a4ffec', bright_green:'#9cf7c2', bright_cyan:'#d1fffe', bright_blue:'#c4d2ed', bright_magenta:'#cddbf4' } },
  { slug:'hermarchy',        c:{ mode:'dark',  accent:'#61d6ff', selection:'#26333a', muted:'#606468', background:'#08090a', dark_background:'#08090a', darker_background:'#050607', lighter_background:'#101214', foreground:'#f1f1ec', dark_foreground:'#606468', bright_foreground:'#ffffff', red:'#e46e6e', yellow:'#e2c275', green:'#86d993', cyan:'#61d6ff', blue:'#74a8c7', magenta:'#b7a1c7', bright_red:'#f08a8a', bright_yellow:'#ecd69a', bright_green:'#a5e4ae', bright_cyan:'#8de4ff', bright_blue:'#94bcd2', bright_magenta:'#cebdda' } },
  { slug:'kanagawa',         c:{ mode:'dark',  accent:'#dcd7ba', selection:'#363646', muted:'#54546d', background:'#1f1f28', dark_background:'#17171e', darker_background:'#111116', lighter_background:'#223249', foreground:'#dcd7ba', dark_foreground:'#727169', bright_foreground:'#dcd7ba', red:'#c34043', yellow:'#c0a36e', green:'#76946a', cyan:'#6a9589', blue:'#7e9cd8', magenta:'#957fb8', bright_red:'#e82424', bright_yellow:'#e6c384', bright_green:'#98bb6c', bright_cyan:'#7aa89f', bright_blue:'#7fb4ca', bright_magenta:'#938aa9' } },
  { slug:'last-horizon',     c:{ mode:'dark',  accent:'#b59790', selection:'#584e51', muted:'#584e51', background:'#0c0b0c', dark_background:'#090809', darker_background:'#060606', lighter_background:'#0c0b0c', foreground:'#fafcfb', dark_foreground:'#584e51', bright_foreground:'#e2dddc', red:'#c38b7b', yellow:'#6b5e73', green:'#87a9b0', cyan:'#a5a0b6', blue:'#b59790', magenta:'#c4d8e2', bright_red:'#c38b7b', bright_yellow:'#6b5e73', bright_green:'#87a9b0', bright_cyan:'#a5a0b6', bright_blue:'#b59790', bright_magenta:'#c4d8e2' } },
  { slug:'lumon',            c:{ mode:'dark',  accent:'#8bc9eb', selection:'#243d56', muted:'#304860', background:'#16242d', dark_background:'#101b21', darker_background:'#0b1216', lighter_background:'#1b2d40', foreground:'#d6e2ee', dark_foreground:'#4d86b0', bright_foreground:'#f2fcff', red:'#4d86b0', yellow:'#6fa4c9', green:'#5e95bc', cyan:'#b4e4f6', blue:'#6fb8e3', magenta:'#8bc9eb', bright_red:'#73a6cb', bright_yellow:'#9dcae5', bright_green:'#86b7d8', bright_cyan:'#d1eef8', bright_blue:'#f2fcff', bright_magenta:'#b1d8ee' } },
  { slug:'lupine',           c:{ mode:'light', accent:'#3264eb', selection:'#d0d0d0', muted:'#9e9e9e', background:'#fafafa', dark_background:'#ececec', darker_background:'#dedede', lighter_background:'#f5f5f5', foreground:'#212121', dark_foreground:'#757575', bright_foreground:'#000000', red:'#c900c4', yellow:'#026fde', green:'#4a2fd0', cyan:'#0c67de', blue:'#3264eb', magenta:'#8a4ad7', bright_red:'#f930fb', bright_yellow:'#358fff', bright_green:'#9f85e0', bright_cyan:'#3986ff', bright_blue:'#5482ff', bright_magenta:'#b363ff' } },
  { slug:'matte-black',      c:{ mode:'dark',  accent:'#e68e0d', selection:'#2a2a2a', muted:'#333333', background:'#121212', dark_background:'#0d0d0d', darker_background:'#090909', lighter_background:'#1e1e1e', foreground:'#bebebe', dark_foreground:'#555555', bright_foreground:'#bebebe', red:'#d35f5f', yellow:'#b91c1c', green:'#ffc107', cyan:'#bebebe', blue:'#e68e0d', magenta:'#d35f5f', bright_red:'#b91c1c', bright_yellow:'#b90a0a', bright_green:'#ffc107', bright_cyan:'#eaeaea', bright_blue:'#f59e0b', bright_magenta:'#b91c1c' } },
  { slug:'miasma',           c:{ mode:'dark',  accent:'#78824b', selection:'#383838', muted:'#666666', background:'#222222', dark_background:'#191919', darker_background:'#121212', lighter_background:'#2c2c2c', foreground:'#c2c2b0', dark_foreground:'#555555', bright_foreground:'#c2c2b0', red:'#685742', yellow:'#b36d43', green:'#5f875f', cyan:'#c9a554', blue:'#78824b', magenta:'#bb7744', bright_red:'#685742', bright_yellow:'#b36d43', bright_green:'#5f875f', bright_cyan:'#c9a554', bright_blue:'#78824b', bright_magenta:'#bb7744' } },
  { slug:'nord',             c:{ mode:'dark',  accent:'#81a1c1', selection:'#434c5e', muted:'#4c566a', background:'#2e3440', dark_background:'#222730', darker_background:'#191c23', lighter_background:'#3b4252', foreground:'#d8dee9', dark_foreground:'#667080', bright_foreground:'#d8dee9', red:'#bf616a', yellow:'#ebcb8b', green:'#a3be8c', cyan:'#88c0d0', blue:'#81a1c1', magenta:'#b48ead', bright_red:'#bf616a', bright_yellow:'#ebcb8b', bright_green:'#a3be8c', bright_cyan:'#8fbcbb', bright_blue:'#81a1c1', bright_magenta:'#b48ead' } },
  { slug:'osaka-jade',       c:{ mode:'dark',  accent:'#509475', selection:'#32473b', muted:'#53685b', background:'#111c18', dark_background:'#0c1512', darker_background:'#090f0d', lighter_background:'#23372b', foreground:'#c1c497', dark_foreground:'#81b8a8', bright_foreground:'#f7e8b2', red:'#ff5345', yellow:'#459451', green:'#549e6a', cyan:'#2dd5b7', blue:'#509475', magenta:'#d2689c', bright_red:'#db9f9c', bright_yellow:'#e5c736', bright_green:'#63b07a', bright_cyan:'#8cd3cb', bright_blue:'#acd4cf', bright_magenta:'#75bbb3' } },
  { slug:'retro-82',         c:{ mode:'dark',  accent:'#faa968', selection:'#134e5a', muted:'#2a6b78', background:'#05182e', dark_background:'#031222', darker_background:'#020c17', lighter_background:'#0a2540', foreground:'#f6dcac', dark_foreground:'#3f8f8a', bright_foreground:'#f6dcac', red:'#f85525', yellow:'#e97b3c', green:'#028391', cyan:'#8cbfb8', blue:'#3f8f8a', magenta:'#3f8f8a', bright_red:'#f85525', bright_yellow:'#e97b3c', bright_green:'#028391', bright_cyan:'#8cbfb8', bright_blue:'#faa968', bright_magenta:'#3f8f8a' } },
  { slug:'ristretto',        c:{ mode:'dark',  accent:'#f38d70', selection:'#403e41', muted:'#72696a', background:'#2c2525', dark_background:'#211b1b', darker_background:'#181414', lighter_background:'#3d2f2a', foreground:'#e6d9db', dark_foreground:'#72696a', bright_foreground:'#e6d9db', red:'#fd6883', yellow:'#f9cc6c', green:'#adda78', cyan:'#85dacc', blue:'#f38d70', magenta:'#a8a9eb', bright_red:'#ff8297', bright_yellow:'#fcd675', bright_green:'#c8e292', bright_cyan:'#9bf1e1', bright_blue:'#f8a788', bright_magenta:'#bebffd' } },
  { slug:'rose-pine',        c:{ mode:'light', accent:'#56949f', selection:'#dfdad9', muted:'#cecacd', background:'#faf4ed', dark_background:'#ede7e1', darker_background:'#e1dbd5', lighter_background:'#f2e9e1', foreground:'#575279', dark_foreground:'#9893a5', bright_foreground:'#575279', red:'#b4637a', yellow:'#ea9d34', green:'#286983', cyan:'#d7827e', blue:'#56949f', magenta:'#907aa9', bright_red:'#b4637a', bright_yellow:'#ea9d34', bright_green:'#286983', bright_cyan:'#d7827e', bright_blue:'#56949f', bright_magenta:'#907aa9' } },
  { slug:'solitude',         c:{ mode:'dark',  accent:'#798186', selection:'#343d41', muted:'#4b4e55', background:'#101315', dark_background:'#0c0e10', darker_background:'#080a0b', lighter_background:'#101315', foreground:'#cacccc', dark_foreground:'#4b4e55', bright_foreground:'#a5aeb4', red:'#565d60', yellow:'#d9dbdc', green:'#9fa5a9', cyan:'#707070', blue:'#798186', magenta:'#aeaeae', bright_red:'#de6145', bright_yellow:'#c9c2b4', bright_green:'#343d41', bright_cyan:'#707070', bright_blue:'#5d6367', bright_magenta:'#9a9a9a' } },
  { slug:'starcitizen',      c:{ mode:'dark',  accent:'#00d4ff', selection:'#1a3a52', muted:'#3a5870', background:'#050b18', dark_background:'#02060d', darker_background:'#01030a', lighter_background:'#0d1626', foreground:'#c8dff0', dark_foreground:'#3a5870', bright_foreground:'#e0f2ff', red:'#ff3a5c', yellow:'#ffc857', green:'#4ade80', cyan:'#00d4ff', blue:'#3a8fff', magenta:'#b07aff', bright_red:'#ff6080', bright_yellow:'#ffd97a', bright_green:'#6ee7a0', bright_cyan:'#5ce6ff', bright_blue:'#6aa6ff', bright_magenta:'#c89cff' } },
  { slug:'starfleet',        c:{ mode:'dark',  accent:'#ff9c00', selection:'#3d2b55', muted:'#6b5a7d', background:'#0a0a10', dark_background:'#05050a', darker_background:'#000000', lighter_background:'#1a1726', foreground:'#ffcc99', dark_foreground:'#8a7a99', bright_foreground:'#ffffcc', red:'#cc6666', yellow:'#ffcc66', green:'#66cc99', cyan:'#99ccff', blue:'#9999ff', magenta:'#cc99cc', bright_red:'#ff8888', bright_yellow:'#ffff99', bright_green:'#88ddaa', bright_cyan:'#bbddff', bright_blue:'#bbbbff', bright_magenta:'#e6b3e6' } },
  { slug:'tokyo-night',      c:{ mode:'dark',  accent:'#7aa2f7', selection:'#292e42', muted:'#414868', background:'#1a1b26', dark_background:'#13141c', darker_background:'#0e0e14', lighter_background:'#24283b', foreground:'#a9b1d6', dark_foreground:'#565f89', bright_foreground:'#c0caf5', red:'#f7768e', yellow:'#e0af68', green:'#9ece6a', cyan:'#449dab', blue:'#7aa2f7', magenta:'#ad8ee6', bright_red:'#ff7a93', bright_yellow:'#ff9e64', bright_green:'#b9f27c', bright_cyan:'#0db9d7', bright_blue:'#7da6ff', bright_magenta:'#bb9af7' } },
  { slug:'vantablack',       c:{ mode:'dark',  accent:'#8d8d8d', selection:'#1a1a1a', muted:'#7a7a7a', background:'#000000', dark_background:'#090909', darker_background:'#070707', lighter_background:'#1a1a1a', foreground:'#ffffff', dark_foreground:'#505050', bright_foreground:'#ffffff', red:'#a4a4a4', yellow:'#cecece', green:'#b6b6b6', cyan:'#b0b0b0', blue:'#8d8d8d', magenta:'#9b9b9b', bright_red:'#a4a4a4', bright_yellow:'#cecece', bright_green:'#b6b6b6', bright_cyan:'#b0b0b0', bright_blue:'#8d8d8d', bright_magenta:'#9b9b9b' } },
  { slug:'white',            c:{ mode:'light', accent:'#6e6e6e', selection:'#c0c0c0', muted:'#808080', background:'#ffffff', dark_background:'#f5f5f5', darker_background:'#e8e8e8', lighter_background:'#c0c0c0', foreground:'#000000', dark_foreground:'#c0c0c0', bright_foreground:'#000000', red:'#2a2a2a', yellow:'#4a4a4a', green:'#3a3a3a', cyan:'#3e3e3e', blue:'#1a1a1a', magenta:'#2e2e2e', bright_red:'#2a2a2a', bright_yellow:'#4a4a4a', bright_green:'#3a3a3a', bright_cyan:'#3e3e3e', bright_blue:'#1a1a1a', bright_magenta:'#2e2e2e' } },
]
// END GENERATED THEMES

const taken = new Set()
const THEMES = RAW.flatMap(({ slug, c }) => {
  const t = buildTheme(slug, c, taken)
  if (!t) return []
  taken.add(t.theme.name)
  return [t]
})

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------
const SWATCH_KEYS = ['background', 'accent', 'foreground', 'red', 'green', 'cyan']

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

function ThemeCard({ entry, ctx }) {
  const swatches = SWATCH_KEYS.map(k => entry.theme.colors[k]).filter(Boolean)
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
          jsx(Button, { size: 'sm', onClick: () => requestTheme(entry.theme.name), children: 'Apply' }),
          jsx(Button, { size: 'sm', variant: 'ghost', onClick: () => ctx.os.writeClipboard(entry.theme.name), children: 'Copy name' }),
        ]
      })
    ]
  })
}

function BrowsePage({ ctx }) {
  const [filter, setFilter] = useState('')
  const q = filter.trim().toLowerCase()
  const visible = q
    ? THEMES.filter(t => t.label.toLowerCase().includes(q) || t.slug.includes(q) || t.mode === q)
    : THEMES

  return jsxs('div', {
    style: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' },
    children: [
      jsx('input', {
        placeholder: 'Filter\u2026',
        value: filter,
        onChange: e => setFilter(e.target.value),
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

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------
export default {
  id: 'omarchy-themes',
  name: 'Omarchy Themes',
  defaultEnabled: false,

  register(ctx) {
    const disposers = []

    THEMES.forEach(entry => {
      disposers.push(ctx.register({ id: 'theme-' + entry.slug, area: THEMES_AREA, data: entry.theme }))
    })

    THEMES.slice(0, 30).forEach(entry => {
      disposers.push(ctx.register({
        id: 'palette-' + entry.slug,
        area: PALETTE_AREA,
        data: {
          id: 'omarchy-themes.apply.' + entry.slug,
          label: 'Apply Omarchy Theme: ' + entry.label,
          action: () => requestTheme(entry.theme.name),
        },
      }))
    })

    ctx.registerSettingsPage?.({
      id: 'settings',
      title: 'Omarchy Themes',
      icon: 'symbol-color',
      order: 10,
      render: () => jsx(BrowsePage, { ctx }),
      children: [{
        id: 'about',
        title: 'About',
        render: () => jsxs('div', {
          style: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--ui-text-secondary)', fontSize: '13px' },
          children: [
            jsx('p', { children: THEMES.length + ' Omarchy themes \u2014 no backend, no network.' }),
            jsx('p', { children: 'Colors baked in from /usr/share/omarchy/themes on the omarchy host.' }),
            jsx('p', { children: 'To update: scripts/generate-themes.py --remote omarchy, then scripts/deploy.sh.' }),
          ]
        })
      }]
    })

    ctx.onDispose(() => disposers.forEach(d => d && d()))
  }
}
