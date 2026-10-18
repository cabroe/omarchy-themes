<div align="center">

# omarchy-themes

**Omarchy colour schemes in Hermes Desktop — automatic on every `omarchy theme set`.**

[![en](https://img.shields.io/badge/lang-en-blue.svg?style=flat-square)](README.md)
[![de](https://img.shields.io/badge/lang-de-blue.svg?style=flat-square)](README.de.md)
[![CI](https://img.shields.io/github/actions/workflow/status/cabroe/omarchy-themes/ci.yml?branch=main&style=flat-square)](https://github.com/cabroe/omarchy-themes/actions/workflows/ci.yml)

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

---

## Install

```bash
# 1. Install the desktop plugin
hermes plugins install https://github.com/cabroe/omarchy-themes
# then: Settings → Capabilities → Plugins → omarchy-themes → enable

# 2. Install the theme-set hook (CLI/TUI auto-sync)
make install-hook
```

Uninstall the hook: `make uninstall`.

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

The picker and ⌘K rows keep working; only the automatic hook-triggered switch is suppressed.

---

## Themes

27 themes ship baked into the plugin (22 dark, 5 light). Each gets a full dual-palette entry — both light and dark variants, both terminal palettes, typography — so flipping modes recolours the entire UI without loading anything from disk.

**Themes missing from the baked table** (user-installed or added after the last `make generate`) are read from `~/.local/state/omarchy/current/theme/colors.toml` and registered as `omarchy-current`. The picker shows them; the auto-sync follows them.

Built-in Hermes themes (`catppuccin`, `everforest`, `solarized`, …) are never overridden. `omarchy theme set catppuccin` paints Hermes' own built-in and the plugin follows its light/dark mode.

---

## After an Omarchy update

```bash
make generate               # rebuilds the theme table (system + user themes)
make generate-system        # system themes only — used by CI
make generate-check         # detect drift without writing
# HOST=<ssh-host> reads themes from a remote machine
```

The generator replaces only the `// BEGIN GENERATED THEMES … // END GENERATED THEMES` block. It resolves themes without `colors.toml` (e.g. `ayaka`) via `omarchy-theme-colors-from-alacritty`.

---

## Development

**Requirements:** Node ≥ 22 · Python ≥ 3.11 · `shellcheck`

```bash
make check          # lint + tests (CI gate)
make test           # node tests/smoke.mjs && sh tests/hook.sh
make lint           # node --check + py_compile + shellcheck
make install-githooks   # pre-push auto-fix hook
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
| `foreground` | `foreground`, `mutedForeground` |
| `accent` | `primary`, `accent`, `ring`, `midground`, `composerRing` |
| `lighter_background` | `card`, `popover`, `secondary`, `userBubble` |
| `dark_background` | `border`, `input`, `sidebarBackground`, `sidebarBorder`, `userBubbleBorder` |
| `selection` | `terminal.selectionBackground` |
| `muted` | `mutedBackground` |
| ANSI 0–15 | terminal palette |

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
