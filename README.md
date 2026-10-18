<div align="center">

# 🎨 omarchy-themes

**Omarchy palettes, Hermes-native — one `theme set`, desktop picker + CLI + TUI all switch.**

[![CI status](https://github.com/cabroe/omarchy-themes/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/cabroe/omarchy-themes/actions/workflows/ci.yml)

[🇩🇪 Deutsche Version](README.de.md)

</div>

---

## Contents

- [🧩 Components](#-components)
- [📦 Install & use](#-install--use)
- [🔄 Updating themes](#-updating-themes)
- [🧪 Tests](#-tests)
- [📁 Project structure](#-project-structure)
- [🔬 Implementation notes](#-implementation-notes)
- [🗺 Colour mapping](#-colour-mapping)
- [📄 License](#-license)

---

## 🧩 Components

- **Desktop plugin** (`desktop/plugin.js`) — Registers Omarchy themes (stock + user via `--include-user`, minus Hermes built-in collisions) in the theme picker, as ⌘K commands, and on a settings page.
- **Theme sync hook** (`hooks/hermes-skin-sync.sh`) — Runs on `omarchy theme set <slug>`, writes `~/.hermes/skins/<slug>.yaml` and activates the Hermes skin.
- **Generator** (`scripts/generate-themes.py`) — Reads `colors.toml` files and rewrites the theme table in the plugin after Omarchy updates.

---

## 📦 Install & use

`hermes plugins install https://github.com/cabroe/omarchy-themes`, then **⌘K → "Reload desktop plugins"**. Enable once: Settings → Capabilities → Plugins → omarchy-themes → Toggle.

For the CLI/TUI hook: `make install-hook` (idempotent); `make uninstall` removes it.

**Development:** Node ≥ 22, Python ≥ 3.11, `shellcheck`. `make check` = lint + tests; `make install-githooks` activates pre-push check.

**What you get:**
- Omarchy themes as `omarchy-<slug>` in picker, ⌘K (`Apply Omarchy Theme: <name>`), and Settings card view with swatches/filter/*Apply*.
- `omarchy theme set nord` switches desktop theme **and** light/dark mode; hook syncs CLI/TUI skin (~3 s delay, 15 s no-op window). `~/.local/state/omarchy/toggles/skip-hermes-theme-changes` disables auto-switching.
- Each theme ships **both** palettes + **both** terminal palettes + typography — light/dark switching recolours the entire UI. Both palettes share brand `accent`/`primary`/`ring`; opposite palette auto-synthesised (Rec.709 luma ≥ 0.5 contrast).
- Unknown themes (user-installed or newer than `make generate`): plugin reads `~/.local/state/omarchy/current/theme/colors.toml` and registers one `omarchy-current` fallback.

---

## 🔄 Updating themes

After an Omarchy update: `make generate` (`HOST=<ssh host>` reads remotely) or `make generate-check` (detect drift). Include user themes: `python3 scripts/generate-themes.py --include-user`. Generator replaces `// BEGIN GENERATED THEMES` … `// END GENERATED THEMES` block only, deterministic, resolves themes without `colors.toml` via `omarchy-theme-colors-from-alacritty` / `omarchy-theme-color`.

---

## 🧪 Tests

```bash
make check    # = lint + test
make test     # node tests/smoke.mjs && sh tests/hook.sh
make lint     # node --check + py_compile + shellcheck
```

- **`tests/smoke.mjs`** — Plugin loads, registers themes/commands/settings, colours valid, luma/brand/prefix enforced, CLI→desktop sync covered.
- **`tests/hook.sh`** — Skin YAML (22 keys, 3-digit hex), skip on unknown, exit 0 on failure, fallback to Omarchy-generated `colors.toml`.
- **`tests/generate_themes_test.py`** — Stdlib `unittest`: `norm_hex`, `parse_palette`, `read_local`, `parse_sections`, `render`, `main()` exit codes, user-theme override.
- **`tests/theme-switch-smoke.sh`** — Live `omarchy theme set` over SSH (`make theme-smoke HOST=omarchy`). Mutates user state; not in `make check`.

CI: `.github/workflows/live-theme-smoke.yml` runs smoke on self-hosted omarchy runner (manual `workflow_dispatch`, Sunday 04:00 UTC, `push` to `main` when smoke/hook/workflow changes). Dedicated, label-pinned; start before trigger, stop after.

---

## 📁 Project structure

```
omarchy-themes/
├── desktop/plugin.js         # Hermes desktop plugin (plain ESM)
├── hooks/hermes-skin-sync.sh # omarchy theme-set hook → Hermes CLI/TUI skin
├── scripts/generate-themes.py  # colors.toml → theme table in plugin.js
├── tests/{smoke.mjs,hook.sh,theme-switch-smoke.sh,stubs/}
├── .github/workflows/        # CI: ci.yml, live-theme-smoke.yml
├── .githooks/pre-push        # generate-check guard
└── Makefile
```

Install target: `~/.hermes/plugins/omarchy-themes/desktop/plugin.js` (auto), `~/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh` (manual `make install-hook`).

---

## 🔬 Implementation notes

Omarchy's `lighter_background` / `darker_background` stay on the wrong side of the renderer's luma threshold (0.5), so UI mode never flips. Plugin synthesises missing palette with `mixHex(c.background, '#000'|'#fff', 0.88)` (see `SURFACE_MIX_AMOUNT` / `ACCENT_TEXT_LUMA` in `desktop/plugin.js`). Brand identity preserved: `accent`/`primary`/`ring`/`midground`/`composerRing` derive from same Omarchy `accent` in both palettes.

---

## 🗺 Colour mapping

### Desktop theme

`accent` → `primary`/`accent`/`ring`/`midground`/`composerRing` (text on top by luminance); `lighter_background` → `card`/`popover`/`secondary`/`userBubble`; `dark_background` → `border`/`input`/`sidebarBackground`/`sidebarBorder`/`userBubbleBorder`; `selection` → `terminal.selectionBackground`; `mode="light"` → additionally `darkColors`/`darkTerminal`. Other keys (`background`, `foreground`, `muted`, `red`, ANSI) pass through 1:1. Missing keys fall back to `background`/`foreground`/`accent`. If `lighter_background` or `dark_background` equal `background`, lifted a few percent for visibility. Full mapping: see `desktop/plugin.js` (`synthLightFromDark` / `synthDarkFromLight`).

### CLI/TUI skin (hook)

22 keys written; rest inherited from `default` skin. `accent` → `ui_accent`/`banner_accent`/`input_rule`; `dark_background` → `banner_border`/`ui_border`/`status_bar_bg`/`session_border`; `green`/`yellow`/`red` → `ui_ok`/`warn`/`error`, `status_bar_good`/`warn`/`critical`; `cyan` → `response_border`/`session_label`. Other keys 1:1. Pure POSIX `sh`, no Python. User theme beats system theme. Exit 0 always. Fallback: Omarchy-generated `~/.local/state/omarchy/current/theme/colors.toml`.

---

## 📄 License

[MIT](LICENSE). Changes in [CHANGELOG.md](CHANGELOG.md); see [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
