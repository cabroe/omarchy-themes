# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow `plugin.yaml`.

## [Unreleased]

### Fixed
- A palette edit under the same unknown slug (`omarchy theme set` re-run on an
  edited custom theme) repaints: `current/theme/colors.toml` is watched as a
  fourth door whose watcher re-arms on every event, because Omarchy swaps the
  theme directory by rename and a plain file watch goes silent after one swap.
- `selection` (the key official theme `colors.toml` files use) is read again
  besides `selection_background`.
- An Omarchy theme named like a Hermes built-in (`solarized`, …) no longer
  overrides that built-in.
- Launch under the `skip-hermes-theme-changes` toggle restores the palette
  shown before instead of Omarchy's current one.
- A disposed plugin instance no longer registers into the next one while its
  file reads are still in flight; failing async doors no longer escape as
  unhandled rejections.
- `requestMode` is probed from `@hermes/plugin-sdk` at call time (lazy, so a
  future SDK re-export of `requestMode` is picked up without a page reload);
  repeat calls with the same `(profile, mode)` short-circuit before the
  storage-event dispatch so a double click on Apply no longer triggers a
  second `ThemeProvider` paint.
- Disposed instance resets its `lastApplied` / `lastRequest` so a fresh
  register's first apply is not silently dropped in the dedupe window.
- `ThemeCard` *Apply* sets `lastApplied` before calling `requestTheme`, so a
  background `skin.changed` event or `watchConfigSkin` tick does not
  ghost-reapply the same theme within `DEDUPE_MS` after a UI-triggered apply.
- The `register()` bridge guard for the file-watcher block now also requires
  `onPreviewFileChanged` and `watchPreviewFile` (besides `readFileText`),
  so `armColors` no longer risks calling a missing method when the SDK
  ships only a subset.
- `armColors` file-watch re-arm: three bugs fixed — (1) the listener is
  registered after `watch.id` is known, so the first event after a
  rename-swap is no longer silently dropped because the payload's `id`
  could not be matched yet; (2) an `alive()` check follows the second
  `await` (`bridge.watchPreviewFile`) so neither listener nor bridge watch
  leaks on dispose-during-await; (3) the previous `armingColors` guard
  skipped a concurrent re-arm entirely and left the watcher without a live
  watch after a burst — replaced by a `pendingRearm` flag that schedules
  a fresh arm in `finally` once the guard clears.
- `paletteFromToml`: `dark_foreground` no longer defaults to `color8`
  (ANSI bright-black); if `muted` also resolves to `color8`, the
  `mutedForeground` was equal to the muted background and rendered
  invisible — `buildTheme` now falls back to `foreground` instead.
- `paletteFromToml` regex extended from `{6}` to `{6}(?:[0-9A-Fa-f]{2})?`,
  so an 8-digit `#RRGGBBAA` hex (with alpha) is no longer silently
  ignored; the alpha byte is stripped before parsing.
- `displaySkin`: tab-indented `config.yaml` yielded `indent=0` for every
  child line, breaking the `display:` block detection; tabs are
  normalized to spaces before the indent pass.

### Removed
- The plugin is back to a single `desktop/plugin.js` file. Hermes-Desktop
  runtime plugins may only import `@hermes/plugin-sdk` and `react` — relative
  imports on sibling files make the plugin fail to load
  (`unsupported imports: ./sync.js, ./lib/...`). The `desktop/lib/`,
  `desktop/sync.js`, `desktop/settings-page.js`, `desktop/sdk-probe.js`,
  `desktop/types.d.ts`, `desktop/runtime-modules.d.ts`, `desktop/tsconfig.json`
  and `tests/generate_themes_test.py` files from the broken module split are
  gone; the `make typecheck` CI step that required `tsconfig.json` is also
  removed.

## [1.2.0] — 2026-10-18

### Added
- Omarchy themes missing from the baked table (user overlays, themes newer than
  the last `make generate`) now follow too: the palette is read from
  `current/theme/colors.toml` and shown as the replaceable theme
  `omarchy-current`; it is registered again after a Hermes restart.
- Omarchy toggle `skip-hermes-theme-changes`
  (`~/.local/state/omarchy/toggles/`) stops all automatic theme switching.
- Omarchy's own `omarchy` skin (`omarchy-theme-set-hermes`) maps to the
  dual-palette entry of the current Omarchy theme instead of Hermes' single-palette
  conversion.

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
