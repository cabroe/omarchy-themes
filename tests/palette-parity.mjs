// Palette parity harness: load plugin.js with the stub loader and resolve a
// colors.toml fixture through the plugin's live paletteFromToml, printing the
// canonical keys as one `key=value …` line for tests/palette-parity.sh to
// compare against the hook (shell) and generator (Python) results.
//
//   node --enable-source-maps tests/palette-parity.mjs <colors.toml>
import * as nodeModule from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from './stubs/loader.mjs'

// registerHooks (Node ≥ 22.15) is in-thread; fall back for older Node.
if (nodeModule.registerHooks) nodeModule.registerHooks({ resolve })
else nodeModule.register('./stubs/loader.mjs', import.meta.url)

const { paletteFromToml } = await import('../desktop/plugin.js')

const text = readFileSync(process.argv[2], 'utf8')
const c = paletteFromToml(text)
if (!c) {
  console.error('paletteFromToml returned null')
  process.exit(2)
}
// Canonical order must match tests/palette-parity.sh.
console.log([
  `background=${c.background}`,
  `foreground=${c.foreground}`,
  `accent=${c.accent}`,
  `red=${c.red}`,
  `green=${c.green}`,
  `yellow=${c.yellow}`,
  `cyan=${c.cyan}`,
  `mode=${c.mode}`,
].join(' '))
