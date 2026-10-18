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
- Keep the English and German READMEs in sync.
- Commit messages: `fix:`, `feat:`, `perf:`, `docs:`, `ci:`, `chore:` prefixes.

## Updating the installed plugin while developing

`~/.hermes/plugins/omarchy-themes` is a tracked git clone: push to GitHub, run
`hermes plugins update omarchy-themes`, then restart Hermes Desktop (or
⌘K → "Reload desktop plugins"). Hook changes need `make install-hook`.
