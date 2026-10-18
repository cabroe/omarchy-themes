<div align="center">

# 🎨 omarchy-themes

**Brings Omarchy colour schemes to Hermes — desktop theme picker and CLI/TUI skin in one.**

[![CI status](https://github.com/cabroe/omarchy-themes/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/cabroe/omarchy-themes/actions/workflows/ci.yml)

<sub>Badge: <code>make check</code> (lint + tests + shellcheck, Node 22 and LTS) on <code>main</code>, straight from GitHub Actions. The theme count depends on the build (it grows with Omarchy releases and with <code>--include-user</code>) and is therefore deliberately not shown as a static badge — <code>node tests/smoke.mjs</code> prints the live number for the current <code>desktop/plugin.js</code>.</sub>

[🇩🇪 Deutsche Version](README.de.md)

</div>

---

## Contents

- [🧩 Components](#-components)
- [📦 Install & use](#-install--use)
  - [🎯 What you get](#-what-you-get)
  - [🛠 What the plugin customises](#-what-the-plugin-customises)
- [🔄 Updating themes](#-updating-themes)
- [🧪 Tests](#-tests)
  - [🔥 Live theme smoke](#-live-theme-smoke)
- [📁 Project structure](#-project-structure)
- [🔬 Implementation notes](#-implementation-notes)
- [🗺 Colour mapping](#-colour-mapping)
  - [🖥 Desktop theme](#-desktop-theme)
  - [⌨️ CLI/TUI skin (hook)](#-clitui-skin-hook)
- [📄 License](#-license)

---

## 🧩 Components

- **Desktop plugin** (`desktop/plugin.js`) — Registers every Omarchy stock theme (plus any user themes from `~/.config/omarchy/themes/` when generated with `--include-user`, minus the Hermes built-in collisions like `catppuccin` / `everforest`) in the Hermes theme picker, as ⌘K commands, and on a dedicated settings page. The count depends on what Omarchy ships and which user themes are installed, so it is not hard-coded anywhere — run `node tests/smoke.mjs` to see the current number for your build. Purely local — no backend, no network.
- **Theme sync hook** (`hooks/hermes-skin-sync.sh`) — Runs on `omarchy theme set <slug>`, writes `~/.hermes/skins/<slug>.yaml` and activates the Hermes skin. CLI and TUI follow the desktop theme automatically.
- **Generator** (`scripts/generate-themes.py`) — Reads `colors.toml` files from the host and rewrites the theme table in the plugin — after Omarchy updates or for custom themes.

---

## 📦 Install & use

**Install via Hermes:**

```bash
hermes plugins install https://github.com/cabroe/omarchy-themes
```

Then **⌘K → "Reload desktop plugins"**. The plugin ships opt-in — Hermes treats the desktop half of a unified `.hermes-package.json` as `defaultEnabled: false`, regardless of the plugin's own default. Enable once: Settings → Capabilities → Plugins → omarchy-themes → Toggle (the same toggle disables it).

For the CLI/TUI hook, run `make install-hook` to install `hooks/hermes-skin-sync.sh` to `~/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh` (idempotent — re-running updates the file in place). `make uninstall` removes it.

**Local requirements (development):** Node ≥ 22, Python ≥ 3.11, `shellcheck`

```bash
make check            # lint + tests locally
make install-githooks # activate the pre-push generate-check hook (optional)
```

### 🎯 What you get

- **Theme picker:** Omarchy themes appear alongside the built-in Hermes themes as `omarchy-<slug>`. Slugs that collide with a Hermes built-in (`catppuccin`, `everforest` …) are skipped — the built-in wins as the Source of Truth.
- **⌘K:** `Apply Omarchy Theme: <name>`
- **Settings → Plugins → omarchy-themes:** Card view with colour swatches, filter (name/slug/`dark`/`light`) and an *Apply* button.
- **CLI/TUI:** `omarchy theme set nord` → the desktop switches theme **and** light/dark mode after ~0.6–0.8 s; the hook follows with the skin (~2.5–3.5 s). Four input paths feed one apply path: `~/.local/state/omarchy/current/theme.name` (file-watch), `display.skin` in `<HERMES_HOME>/config.yaml`, the gateway event `skin.changed`, and `current/theme/colors.toml` itself (re-arms on every event). Repeats of the same name within 15 s are no-ops. The plugin remembers the last-seen theme so a delayed catch-up works on launch; Omarchy's toggle `~/.local/state/omarchy/toggles/skip-hermes-theme-changes` stops all automatic switching (picker and ⌘K keep working).
- **Plugin themes ship as `omarchy-<slug>`, CLI skins as `<slug>`:** the prefix stops a once-active CLI skin from painting its single-palette conversion (`resolveTheme` prefers backend skin themes). After a CLI switch the picker may list both "Nord" and "Omarchy Nord" — pick the Omarchy one.
- **Unknown themes** (user-installed or newer than `make generate`): the plugin reads `~/.local/state/omarchy/current/theme/colors.toml` and registers one replaceable `omarchy-current` entry (label "Omarchy <slug>"). Omarchy's own `omarchy` skin (`omarchy-theme-set-hermes`) is treated as the current Omarchy theme too.

### 🛠 What the plugin customises

Every registered theme ships **both** palettes + **both** terminal palettes + **typography**, so switching between light and dark mode in Hermes recolours the entire UI — not just the border:

| Field | Purpose |
|---|---|
| `colors` / `darkColors` | Background, card, popover, sidebar, input, border, primary/accent, muted, destructive, user bubble. Both palettes share the same brand `accent`/`primary`/`ring`/`midground`/`composerRing`; the opposite palette is auto-synthesised so every theme has true light/dark contrast (Rec.709 luma ≥ 0.5 between `colors.background` and `darkColors.background`). See [Implementation notes](#-implementation-notes). |
| `terminal` / `darkTerminal` | ANSI palette (black/white + 8 colours + bright variants) for the integrated terminal |
| `typography` | `fontSans` (system stack with emoji fallback), `fontMono` (JetBrains Mono stack) |

---

## 🔄 Updating themes

Palettes are baked into the plugin (the desktop renderer has no filesystem access). After an Omarchy update, run `make generate` (`HOST=<ssh host>` reads remotely) or `make generate-check` to detect drift without rewriting. Include user themes with `python3 scripts/generate-themes.py --include-user`. The generator only replaces the block between `// BEGIN GENERATED THEMES` and `// END GENERATED THEMES`, is deterministic, and resolves themes without a `colors.toml` (only `alacritty.toml`) via Omarchy's own `omarchy-theme-colors-from-alacritty` / `omarchy-theme-color` CLI tools.

---

## 🧪 Tests

```bash
make check    # = lint + test
make test     # node tests/smoke.mjs && sh tests/hook.sh
make lint     # node --check + py_compile + shellcheck
```

| Test | Checks |
|---|---|
| `tests/smoke.mjs` | Plugin loads in Node and registers all themes, ⌘K commands (each with `label` + `run`, otherwise the host hides them), and the settings page. All colours are valid `#rrggbb`, no duplicate names, all desktop names `omarchy-` prefixed. Enforces luma difference ≥ 0.5 between `colors` and `darkColors` (aligned with renderer threshold), completeness of 25 UI keys per palette, and brand consistency (identical `accent`/`primary`/`ring`/`midground`/`composerRing` in both palettes). Also covers the CLI→desktop sync: mode persistence per profile, built-in/foreign skins, re-apply after the host's own skin handling, and the `display.skin` config watch (baseline vs. catch-up on launch, apply on change, dispose). |
| `tests/hook.sh` | Skin YAML (22 keys, lowercase, 3-digit hex expansion), skip on unknown slug, exit 0 when `hermes` fails, fallback to the colors.toml Omarchy generated for themes without their own, mode from background luma. |
| `tests/generate_themes_test.py` | Stdlib `unittest` for `scripts/generate-themes.py`: `norm_hex` (3-/6-digit, lowercase, invalid), `parse_palette` (corrupt TOML, missing `background`, missing ANSI, 3- and 6-digit hex normalisation, `mode` handling including default-when-absent, extra keys ignored), `read_local` (slug discovery, missing dir, sort order), `parse_sections` (single, multiple, empty), `render` (marker contract), and `main()` exit codes (0/1/2) with `TemporaryDirectory` fixtures — including user-theme override on slug collision (`--include-user`). |
| `tests/theme-switch-smoke.sh` | Live: real `omarchy theme set` through the hook chain over SSH (`make theme-smoke`). Covers the CLI/TUI skin pipeline only, not the desktop plugin; not part of `make check`. |

### 🔥 Live theme smoke

`tests/theme-switch-smoke.sh` runs `omarchy theme set` against a real Omarchy host — system themes, user-installed themes, the actual hook chain. It is **not** part of `make check` because it mutates user state (the active skin, `~/.hermes/skins/*.yaml`).

Locally:

```bash
make theme-smoke HOST=omarchy    # omarchy = a host in your ~/.ssh/config
```

In CI: `.github/workflows/live-theme-smoke.yml` runs the same target on the omarchy self-hosted GitHub Actions runner (`runs-on: [self-hosted, omarchy, omarchy-themes]`). Triggers:

- `workflow_dispatch` — manual, `gh workflow run live-theme-smoke.yml`
- `schedule: '0 4 * * 0'` — Sunday 04:00 UTC, catches Omarchy-side drift
- `push` to `main` when `tests/theme-switch-smoke.sh`, `hooks/hermes-skin-sync.sh`, or the workflow file itself changes

The runner is a **dedicated, label-pinned** install on the omarchy workstation (see `SECURITY.md`). It is not 24/7: start it before triggering, stop it afterwards. The job has no secrets — only `contents: read`.

Without `make`:

```bash
node --check desktop/plugin.js
python3 -m py_compile scripts/generate-themes.py
shellcheck hooks/hermes-skin-sync.sh tests/hook.sh
node tests/smoke.mjs
sh tests/hook.sh
python3 -m unittest tests/generate_themes_test.py
```

---

## 📁 Project structure

```
omarchy-themes/
├── desktop/plugin.js         # Hermes desktop plugin (plain ESM, no build step)
├── hooks/hermes-skin-sync.sh # omarchy theme-set hook → Hermes CLI/TUI skin
├── scripts/
│   └── generate-themes.py    # colors.toml → theme table in plugin.js
├── tests/
│   ├── smoke.mjs             # plugin in Node with SDK stubs
│   ├── hook.sh               # hook against fixture in sandbox $HOME
│   ├── theme-switch-smoke.sh # live hook-chain test over SSH (`make theme-smoke`, not in `make check`)
│   └── stubs/                # @hermes/plugin-sdk, react, react/jsx-runtime
├── .github/                  # CI workflow, issue/PR templates, Dependabot
├── .githooks/pre-push        # generate-check before every push (`make install-githooks`)
├── Makefile
├── CHANGELOG.md  LICENSE  SECURITY.md  CONTRIBUTING.md
└── README.md
```

The desktop plugin path (`desktop/plugin.js`) matches what the Hermes plugin loader looks for on `hermes plugins install <url>` (see `findDesktopEntry` in `desktop-plugin-install.ts`). Previously the plugin lived at `plugin/desktop/plugin.js` — the loader did not find it there and failed with "No agent or desktop plugin artifacts found".

Target paths after install:

| File | Destination |
|---|---|
| `desktop/plugin.js` | `~/.hermes/plugins/omarchy-themes/desktop/plugin.js` |
| `hooks/hermes-skin-sync.sh` | copy manually to `~/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh` |

---

## 🔬 Implementation notes

Why a custom mixer instead of Omarchy's own `lighter_background` / `darker_background`?
Omarchy's "lighter" of a dark theme is still dark-grey (`nord` `#3b4252`, luma ≈ 0.18),
and the "darker" of a light theme is still light-grey (`lupine` `#dedede`, luma ≈ 0.87).
The renderer (`renderedModeFor` in `apps/desktop/src/themes/context.tsx`) evaluates the
surface luma against 0.5 and picks light vs. dark from that — so Omarchy's own variants
stay on the wrong side of the threshold and the UI mode never flips.

The plugin synthesises the missing palette with
`mixHex(c.background, '#000' | '#fff', 0.88)` — the native background pulled 88 %
towards black (for a light theme's dark variant) or white (for a dark theme's light
variant). The `tests/smoke.mjs` luma test enforces the ≥ 0.5 threshold for every
registered theme.

Brand identity is preserved because `accent` / `primary` / `ring` / `midground` /
`composerRing` are derived from the same Omarchy `accent` in both palettes — `lupine`
is always lupine-blue and `nord` is always nord-cyan, regardless of mode. See
`desktop/plugin.js` (`synthLightFromDark` / `synthDarkFromLight`).

The only knobs this plugin exposes are `SURFACE_MIX_AMOUNT` (0.88) and
`ACCENT_TEXT_LUMA` (0.55) at the top of the color-helpers section in
`plugin.js` — both are named constants so the renderer-facing numbers stay
one search away from their definition.

---

## 🗺 Colour mapping

### 🖥 Desktop theme

| `colors.toml` | Hermes `DesktopTheme` |
|---|---|
| `background` | `background`, `terminal.black`, `terminal.brightBlack` |
| `foreground` | `foreground` + all `*Foreground`, `terminal.foreground/cursor/brightWhite` |
| `accent` | `primary`, `accent`, `ring`, `midground`, `composerRing`; text colour on top (white/black) by luminance |
| `lighter_background` | `card`, `popover`, `secondary`, `userBubble` |
| `dark_background` | `border`, `input`, `sidebarBackground`, `sidebarBorder`, `userBubbleBorder` |
| `muted` / `dark_foreground` | `muted` / `mutedForeground` |
| `red` | `destructive` |
| `selection` | `terminal.selectionBackground` |
| `red…magenta`, `bright_*` | `terminal.*` / `terminal.bright*` |
| `mode = "light"` | additionally `darkColors`/`darkTerminal` from `dark_background`/`darker_background` |

Missing keys fall back to `background`/`foreground`/`accent`. If any of these three is missing, the theme is skipped. If `lighter_background` equals `background` (Omarchy derives that for themes without surface shades, e.g. aetheria, ayaka, cpunk, last-horizon, solitude), cards and popovers are lifted off the page colour by a few percent; if `dark_background` equals `background` (hermarchy, omacarchy) the sidebar and border shade is lifted too, so sidebar and borders stay visible.

### ⌨️ CLI/TUI skin (hook)

The hook writes 22 keys; everything else is inherited by the skin loader from the `default` skin.

| `colors.toml` | `~/.hermes/skins/<slug>.yaml` |
|---|---|
| `background` | `background` |
| `foreground` | `banner_title`, `banner_text`, `ui_text`, `prompt`, `status_bar_text` |
| `accent` | `ui_accent`, `banner_accent`, `input_rule` |
| `dark_background` | `banner_border`, `ui_border`, `status_bar_bg`, `session_border` |
| `muted` | `banner_dim` |
| `green` / `yellow` / `red` | `ui_ok/warn/error`, `status_bar_good/warn/critical` |
| `cyan` | `response_border`, `session_label` |

The hook is pure POSIX `sh` with no Python dependency. A user theme takes precedence over a system theme with the same name. It always exits with code 0 so it never breaks Omarchy's hook chain. For themes without a `colors.toml` of their own the hook falls back to the `colors.toml` Omarchy generated for the theme it just applied (`~/.local/state/omarchy/current/theme/`, only while `theme.name` matches), including the `colorN` names.

---

## 📄 License

[MIT](LICENSE). Changes are listed in the [changelog](CHANGELOG.md); see [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).