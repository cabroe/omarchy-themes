<div align="center">

# omarchy-themes

**Omarchy colour schemes in Hermes Desktop — automatic on every `omarchy theme set`.**

[![en](https://img.shields.io/badge/lang-en-blue.svg?style=flat-square)](README.md)
[![de](https://img.shields.io/badge/lang-de-blue.svg?style=flat-square)](README.de.md)
[![Release](https://img.shields.io/github/v/release/cabroe/omarchy-themes?style=flat-square&label=release)](https://github.com/cabroe/omarchy-themes/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/cabroe/omarchy-themes/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/cabroe/omarchy-themes/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/cabroe/omarchy-themes?style=flat-square)](LICENSE)

</div>

---

## What it does

`omarchy theme set nord` — and Hermes Desktop switches palette, light/dark mode, and terminal colours in under a second. No manual step needed.

**Three parts, one flow:**

| Component | File | Role |
|---|---|---|
| Desktop plugin | `desktop/plugin.js` | Theme picker · ⌘K commands · settings page · auto-sync |
| Theme-set hook | `hooks/hermes-skin-sync.sh` | Writes `~/.hermes/skins/<slug>.yaml`, calls `hermes skin use` |
| Generator | `scripts/generate-themes.py` | Rebuilds the baked theme table after an Omarchy update |

The settings page, with every Omarchy theme as a card — shown in Tokyo Night:

![Theme picker in Hermes Desktop](assets/screenshots/themes-dark.png)

Applying a light theme repaints the desktop the same way — shown in Catppuccin Latte:

![Theme picker in a light theme](assets/screenshots/themes-light.png)

The About page documents how the sync works and lists the theme counts:

![About page](assets/screenshots/about.png)

---

## Install

```bash
hermes plugins install https://github.com/cabroe/omarchy-themes
# then: Settings → Capabilities → Plugins → omarchy-themes → enable
```

---

## Uninstall

```bash
hermes plugins remove omarchy-themes
# then restart Hermes Desktop so the plugin stops registering its themes
```

---

## Usage

### Auto-sync from the terminal

```bash
omarchy theme set nord          # switches Hermes Desktop immediately
omarchy theme set lupine        # light themes flip the UI to light mode
omarchy theme set omacarchy     # user themes work too
```

Hermes Desktop picks up the change via `current/theme.name` (written ~0.5 s in), `display.skin` in the config, and the gateway `skin.changed` event — whichever arrives first.

### From inside Hermes Desktop

- **Settings → Plugins → omarchy-themes** — card grid with colour swatches, filter, *Apply* button.
- **⌘K → "Apply Omarchy Theme: Nord"** — one keystroke per theme.

### Disable auto-switching

```bash
touch ~/.local/state/omarchy/toggles/skip-hermes-theme-changes
```

The hook checks the toggle at startup and exits 0 without writing or activating a skin; the desktop plugin also stops its auto-sync and falls back to the palette shown before the toggle was raised. The picker and ⌘K rows still work — they are user-initiated and bypass the toggle.

---

## Themes

The plugin bridges Omarchy's palette catalogue into Hermes Desktop: it recognises every Omarchy theme and makes it selectable from the theme picker and ⌘K, and switches the active Hermes Desktop design automatically whenever you change the Omarchy theme — `omarchy theme set nord` flips both palettes and the light/dark mode in under a second.

Omarchy themes the plugin does **not** already know (user overlays, themes added after the last `make generate`) are read live from `~/.local/state/omarchy/current/theme/colors.toml` and shown as the replaceable entry `omarchy-current`. The picker shows it; the auto-sync follows it.

Built-in Hermes themes (`catppuccin`, `everforest`, `solarized`, …) are never overridden. `omarchy theme set catppuccin` paints Hermes' own built-in and the plugin follows its light/dark mode.

---

## After an Omarchy update

```bash
make generate               # rebuilds the baked table from system themes (default — matches what's committed)
make generate-system        # alias for `make generate`; kept for the regen-themes workflow
make generate-check         # block the push if the baked table drifted from the live themes
# HOST=<ssh-host> reads themes from a remote machine
# Pass --include-user (or SYSTEM=…) to bake user themes locally. User themes
# the table does not know are still picked up live as `omarchy-current`.
```

The generator replaces only the `// BEGIN GENERATED THEMES … // END GENERATED THEMES` block. It resolves themes without `colors.toml` (e.g. `ayaka`) via `omarchy-theme-colors-from-alacritty`.

---

## Development

**Requirements:** Node ≥ 22 · Python ≥ 3.11 · `shellcheck`

```bash
make check          # lint + tests (CI gate)
make test           # node tests/smoke.mjs && sh tests/hook.sh
make lint           # node --check + py_compile + shellcheck
make install-githooks   # pre-push: blocks on baked-table drift (run 'make generate', commit, retry)
```

**Tests:**

- `tests/smoke.mjs` — plugin loads, all themes registered, palettes valid, luma/brand/prefix enforced, CLI→desktop sync path covered.
- `tests/hook.sh` — skin YAML shape (22 keys, 3-digit hex), skip on unknown slug, exit 0 always, fallback to Omarchy-generated `colors.toml`.
- `tests/theme-switch-smoke.sh` — live `omarchy theme set` over SSH (`make theme-smoke HOST=omarchy`). Mutates state; not in `make check`.

---

## Project layout

```
omarchy-themes/
├── desktop/
│   └── plugin.js                   # Hermes Desktop plugin (plain ESM, no deps)
├── hooks/
│   └── hermes-skin-sync.sh         # theme-set hook → CLI/TUI skin
├── scripts/
│   └── generate-themes.py          # colors.toml → baked table in plugin.js
├── tests/
│   ├── smoke.mjs
│   ├── hook.sh
│   ├── theme-switch-smoke.sh
│   └── stubs/
├── .github/workflows/              # ci.yml · live-theme-smoke.yml · regen-themes.yml
├── .githooks/pre-push
├── plugin.yaml
└── Makefile
```

---

## Colour mapping

### Desktop palette

| Omarchy key | Hermes slots |
|---|---|
| `background` | `background` |
| `foreground` | `foreground` |
| `dark_foreground` | `mutedForeground` |
| `accent` | `primary`, `accent`, `ring`, `midground`, `composerRing` |
| `lighter_background` | `card`, `popover`, `secondary`, `userBubble` |
| `dark_background` | `border`, `input`, `sidebarBackground`, `sidebarBorder`, `userBubbleBorder` |
| `selection` / `selection_background` | `terminal.selectionBackground` |
| `muted` | `muted` |
| ANSI 1–6 and 9–14 (`red`/`green`/`yellow`/`blue`/`magenta`/`cyan` and bright variants) | terminal palette; `background` fills `black` + `brightBlack`, `foreground` fills `white` + `brightWhite` |

`lighter_background` and `dark_background` are lifted a few percent when equal to `background` (affects hermarchy, omacarchy, and flat themes). The opposite palette (light↔dark) is auto-synthesised using Rec.709 luma — the synthesised background always lands on the correct side of the 0.5 threshold so UI mode never flips unexpectedly.

### CLI/TUI skin (hook)

22 keys written to `~/.hermes/skins/<slug>.yaml`; the rest inherit from the `default` skin.

| Omarchy key | Hermes skin keys |
|---|---|
| `accent` | `ui_accent`, `banner_accent`, `input_rule` |
| `dark_background` | `banner_border`, `ui_border`, `status_bar_bg`, `session_border` |
| `green` / `yellow` / `red` | `ui_ok`/`warn`/`error`, `status_bar_good`/`warn`/`critical` |
| `cyan` | `response_border`, `session_label` |

Pure POSIX `sh`. Exit 0 always. Fallback: `~/.local/state/omarchy/current/theme/colors.toml`.

---

## License

[MIT](LICENSE) — Carsten Broeckert.  
Changes: [CHANGELOG.md](CHANGELOG.md) · Contributing: [CONTRIBUTING.md](CONTRIBUTING.md) · Security: [SECURITY.md](SECURITY.md)
