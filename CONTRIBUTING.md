# Contributing

Thanks for helping. The short version:

```bash
make check               # lint + tests, no Omarchy needed (needs Node >= 22, Python >= 3.11, shellcheck)
make install-githooks    # optional: pre-push 'make generate-check' — blocks the push on baked-table drift (no auto-commit; regenerate and commit by hand)
make theme-smoke HOST=omarchy   # live hook-chain test — mutates the active skin, see Tests / SECURITY
```

## Rules of thumb

- `desktop/plugin.js` is plain ESM with no build step — Hermes loads the single
  file as is. The block between `// BEGIN GENERATED THEMES` and
  `// END GENERATED THEMES` is generated: change palettes with
  `make generate`, never by hand.
- Behaviour changes need a test in `tests/smoke.mjs` (plugin) or `tests/hook.sh`
  (hook). Tests must be deterministic and host-free; live checks against a real
  Omarchy/Hermes belong in `tests/theme-switch-smoke.sh` (`make theme-smoke`)
  and require either an omarchy host in `~/.ssh/config` or the omarchy
  self-hosted GitHub Actions runner (label `omarchy, omarchy-themes`).
- The hook stays POSIX `sh` without Python and always exits 0.
- The sync is one-directional: Omarchy → Hermes Desktop, never the reverse.
  The picker does not write back to Omarchy. The plugin watches four signals
  (`theme.name`, `config.yaml`'s `display.skin`, the `skin.changed` gateway
  event, and `colors.toml`) and collapses them to one apply with a 15 s
  dedupe window (`DEDUPE_MS`). Two distinct theme sets inside that window can
  drop the second through the file doors; only `skin.changed`/`colors.toml`
  force through.
- The plugin runs in the sandboxed renderer (no fs) and reads files through
  the non-stable `window.hermesDesktop` bridge (`readFileText`,
  `watchPreviewFile`, `onPreviewFileChanged`, `getMachineProfile`,
  `desktopPluginsRoot`). `requestMode` already has a local storage-event
  mirror because the SDK does not re-export it — any Hermes bridge/SDK change
  is a regression risk here.
- The `colors.toml` → palette mapping is implemented three times (hook shell,
  generator Python, plugin `paletteFromToml`). They must stay in lockstep;
  `tests/palette-parity.sh` pins the shared mapping across all three. The
  mode fallback is deliberately split: hook → Omarchy's raw R+G+B > 382,
  generator/plugin → Rec.709 luma > 0.5 (the renderer's cutoff).
- Keep the English and German READMEs in sync.
- Commit messages: `fix:`, `feat:`, `perf:`, `docs:`, `ci:`, `chore:` prefixes.

## Updating the installed plugin while developing

The plugin lives at `~/.hermes/desktop-plugins/omarchy-themes/`. Push your
changes to GitHub, then either `hermes plugins update omarchy-themes` (the
official upgrade path) or `make install-hook` to update the hook in place,
followed by restarting Hermes Desktop (or ⌘K → "Reload desktop plugins").
