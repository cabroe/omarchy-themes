# Contributing

Thanks for helping. The short version:

```bash
make check               # lint + tests, no Omarchy needed (needs Node >= 22, Python >= 3.11, shellcheck)
make install-githooks    # optional: pre-push check that plugin.js matches the Omarchy themes
```

## Rules of thumb

- `desktop/plugin.js` is plain ESM with no build step — Hermes loads the single
  file as is. The block between `// BEGIN GENERATED THEMES` and
  `// END GENERATED THEMES` is generated: change palettes with
  `make generate`, never by hand.
- Behaviour changes need a test in `tests/smoke.mjs` (plugin) or `tests/hook.sh`
  (hook). Tests must be deterministic and host-free; live checks against a real
  Omarchy/Hermes belong in the pull request description.
- The hook stays POSIX `sh` without Python and always exits 0.
- Keep the English and German READMEs in sync.
- Commit messages: `fix:`, `feat:`, `perf:`, `docs:`, `ci:`, `chore:` prefixes.

## Updating the installed plugin while developing

`~/.hermes/plugins/omarchy-themes` is a tracked git clone: push to GitHub, run
`hermes plugins update omarchy-themes`, then restart Hermes Desktop (or
⌘K → "Reload desktop plugins"). Hook changes need `make install-hook`.
