# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow `plugin.yaml`.

## [Unreleased]

### Changed
- Repository is public. `main` is protected (no force pushes or deletions, linear
  history, CI must pass for everyone except the owner); secret scanning with push
  protection, Dependabot alerts and private vulnerability reporting are enabled.

## [1.1.0] — 2026-10-18

### Changed
- **Switch time after `omarchy theme set` ~0.6–0.8 s instead of ~3 s.** The
  plugin watches Omarchy's `current/theme.name` (written ~0.5 s in), the
  earliest signal. `display.skin` in the Hermes config and the gateway event
  `skin.changed` stay as further doors; repeats of the same name within 15 s are
  no-ops.
- Desktop themes are registered as `omarchy-<slug>` (label "Omarchy Nord").
  Hermes adopts every CLI skin as a single-palette backend theme under the bare
  slug and prefers it over a plugin theme of the same name; the prefix keeps the
  dual light/dark palettes in charge. Hook and CLI skin names are unchanged.
- The forced `skin.changed` re-apply runs in a microtask, so Hermes' own
  single-palette skin is never painted (no flicker with a local gateway).
- Cards, sidebar and borders are lifted off the page colour for palettes Omarchy
  ships without surface shades (aetheria, ayaka, cpunk, last-horizon, solitude)
  or with `dark_background == background` (hermarchy, omacarchy).
- `make generate` / `generate-check` read the local Omarchy themes by default;
  `HOST=<ssh host>` reads them remotely. The pre-push hook uses the same rule.
- CI runs on Node 22 and the current LTS, can be started manually, and no longer
  commits a badge to `main`.

### Added
- Themes without their own `colors.toml` (e.g. `ayaka`, only an
  `alacritty.toml`): the generator resolves them with Omarchy's own tools, the
  hook falls back to the `colors.toml` Omarchy generated for the applied theme
  and understands `colorN` names; light/dark is derived from the background.
- Catch-up at launch: a theme switched while Hermes was closed is applied once;
  an unchanged theme leaves a pick made in the desktop alone.
- `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, issue and PR templates.

### Fixed
- ⌘K rows were hidden by Hermes (`action:` instead of `run:`).
- Dead gateway polling, DOM/CSS repaint and iframe code removed; the light/dark
  mode is persisted like Hermes does (live profile + global slot only) instead
  of overwriting every profile.
- Built-in collisions (`catppuccin`, `everforest`) follow the Omarchy palette's
  mode instead of forcing dark.
- The smoke test no longer hangs (CI had been cancelled after 10 minutes).
- README: a plugin installed from Git ships disabled and must be enabled once.

## [1.0.0]

Initial release: desktop theme picker, ⌘K commands, settings page, Omarchy
theme-set hook writing Hermes skins, theme-table generator.
