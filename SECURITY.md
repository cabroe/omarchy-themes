# Security policy

## What runs where

- `desktop/plugin.js` runs inside the Hermes Desktop renderer, limited to the
  plugin SDK surface (`hermes plugins validate` checks that). It has no network
  access of its own; it reads two local files through the desktop's file-watch
  bridge (`~/.local/state/omarchy/current/theme.name` and
  `<HERMES_HOME>/config.yaml`) and writes only the desktop's own appearance keys
  in `localStorage`.
- `hooks/hermes-skin-sync.sh` runs as your user from Omarchy's `theme-set.d`
  hook chain. It writes `~/.hermes/skins/<slug>.yaml` and calls `hermes skin use`.
  It never exits non-zero, so it cannot break the hook chain.

## Reporting a vulnerability

Please do **not** open a public issue. Mail the maintainer (address on the
GitHub profile). Once the repository is public, GitHub's private vulnerability
reporting (Security tab → "Report a vulnerability") will be enabled as well.
You will get an answer within a week.

## Supported versions

Only the latest release / `main` is supported.
