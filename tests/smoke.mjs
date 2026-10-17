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

const { default: plugin } = await import('../plugin/desktop/plugin.js')

const contributions = []
const settingsPages = []
const disposers = []
const ctx = {
  register: c => { contributions.push(c); return () => {} },
  registerSettingsPage: p => settingsPages.push(p),
  onDispose: fn => disposers.push(fn),
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
}

// Built-in Hermes names must be suffixed, never shadowed.
assert.ok(names.has('catppuccin-omarchy') || !names.has('catppuccin'))

console.log(`ok — ${themes.length} themes, ${palette.length} palette commands, ${settingsPages.length} settings page`)
