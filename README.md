# 🎨 omarchy-themes

<p align="center">
  <b>Brings Omarchy colour schemes to Hermes — desktop theme picker and CLI/TUI skin in one.</b>
</p>

<p align="center">
  <a href=".github/workflows/ci.yml"><img src=".github/badges/ci.svg" alt="CI status"></a>
</p>

<p align="center"><sub>Single live badge: <code>make check</code> (lint + tests + shellcheck) on <code>main</code>, updated automatically by the <a href=".github/workflows/ci.yml"><code>badge</code> job</a>. The theme count is build-dependent (it grows with Omarchy releases and with <code>--include-user</code>) and is therefore deliberately not shown as a static badge — the live number for the current <code>desktop/plugin.js</code> is printed by <code>node tests/smoke.mjs</code>.</sub></p>

<p align="center">
  <a href="README.de.md">🇩🇪 Deutsche Version</a>
</p>

---

## 🧩 Components

| Component | File | What it does |
|---|---|---|
| **Desktop plugin** | `desktop/plugin.js` | Registers every Omarchy stock theme (plus any user themes from `~/.config/omarchy/themes/` when generated with `--include-user`, minus the Hermes built-in collisions like `catppuccin` / `everforest`) in the Hermes theme picker, as ⌘K commands, and on a dedicated settings page. The count depends on what Omarchy ships and which user themes are installed, so it is not hard-coded anywhere — run `node tests/smoke.mjs` to see the current number for your build. Purely local — no backend, no network. |
| **Theme sync hook** | `hooks/hermes-skin-sync.sh` | Runs on `omarchy theme set <slug>`, writes `~/.hermes/skins/<slug>.yaml` and activates the Hermes skin. CLI and TUI follow the desktop theme automatically. |
| **Generator** | `scripts/generate-themes.py` | Reads `colors.toml` files from the host and rewrites the theme table in the plugin — after Omarchy updates or for custom themes. |


---

## ⚡ Quick start

**Install via Hermes:**

```bash
hermes plugins install https://github.com/cabroe/omarchy-themes
```

Then: **⌘K → "Reload desktop plugins"**. A plugin installed this way ships opt-in — Hermes treats the desktop half of a unified package (marker `.hermes-package.json`) as `defaultEnabled: false`, regardless of the plugin's own default. Enable it once: Settings → Capabilities → Plugins → omarchy-themes → Toggle (the same toggle disables it).

For the CLI/TUI hook, run `make install-hook` to install `hooks/hermes-skin-sync.sh` to `~/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh` (idempotent — re-running updates the file in place). `make uninstall` removes it.

**Local requirements (for development):** Node ≥ 22, Python ≥ 3.11, `shellcheck`

```bash
make check            # lint + tests locally
make install-githooks # activate the pre-push generate-check hook (optional)
```

---

## 🖥 Usage

- **Theme picker:** Omarchy themes appear alongside the built-in Hermes themes. Names that collide with a Hermes built-in (`catppuccin`, `everforest` …) are skipped — the built-in wins as the Source of Truth. Use the built-in `catppuccin` / `everforest` directly via Hermes; the plugin does **not** register an `…-omarchy` clone.
- **⌘K:** `Apply Omarchy Theme: <name>`
- **Settings → Plugins → omarchy-themes:** Card view with colour swatches, filter (name/slug/`dark`/`light`) and an *Apply* button.
- **CLI/TUI:** `omarchy theme set nord` → hook writes skin → `hermes skin use nord` (live in ~1 s). The desktop picks the theme up and also switches into the palette's mode (light/dark). Two doors lead there: the gateway event `skin.changed` (when the desktop is connected to this machine) and a watch on `display.skin` in the local `<HERMES_HOME>/config.yaml` via the desktop's file-watch bridge — so the sync also works while a remote gateway is the active connection.

### ⚠️ Known limitations

- **CLI skins shadow plugin themes of the same name.** Hermes adopts every activated skin as a desktop theme of its own (`description: "Hermes skin"`, cached in `hermes-desktop-backend-themes-v1`). `resolveTheme` prefers these backend themes over plugin themes of the same name (built-in > user > backend > plugin). Once a slug has been active via the hook, the desktop paints the skin's simplified single-palette conversion for that name instead of the plugin's dual palette — via ⌘K and the settings page too. A clean fix needs a change in Hermes (plugin themes before backend skins of the same name).

### What the plugin customises

Every registered theme ships **both** palettes + **both** terminal palettes + **typography**, so switching between light and dark mode in Hermes recolours the entire UI — not just the border:

| Field | Purpose |
|---|---|
| `colors` / `darkColors` | Background, card, popover, sidebar, input, border, primary/accent, muted, destructive, user bubble. Both palettes share the same brand `accent`/`primary`/`ring`/`midground`/`composerRing`; the opposite palette is auto-synthesised so every theme has true light/dark contrast (Rec.709 luma ≥ 0.5 between `colors.background` and `darkColors.background`). See [Implementation notes](#-implementation-notes). |
| `terminal` / `darkTerminal` | ANSI palette (black/white + 8 colours + bright variants) for the integrated terminal |
| `typography` | `fontSans` (system stack with emoji fallback), `fontMono` (JetBrains Mono stack) |

### 🔬 Implementation notes

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

## 🔄 Updating themes

Palettes are baked into the plugin (the desktop renderer has no filesystem access). After an Omarchy update:

```bash
make generate          # re-read palettes and rewrite plugin.js
make generate-check    # only check whether plugin.js is up to date (exit 1 if not)
```

To include custom themes from `~/.config/omarchy/themes/`:

```bash
python3 scripts/generate-themes.py --include-user
```

The generator only replaces the block between `// BEGIN GENERATED THEMES` and `// END GENERATED THEMES` and is deterministic — no diff if nothing changed.

---

## 🧪 Tests

```bash
make check    # = lint + test
make test     # node tests/smoke.mjs && sh tests/hook.sh
make lint     # node --check + py_compile + shellcheck
```

| Test | Checks |
|---|---|
| `tests/smoke.mjs` | Plugin loads in Node and registers all themes, ⌘K commands (each with `label` + `run`, otherwise the host hides them), and the settings page. All colours are valid `#rrggbb`, no duplicate names. Enforces luma difference ≥ 0.5 between `colors` and `darkColors` (aligned with renderer threshold), completeness of 25 UI keys per palette, and brand consistency (identical `accent`/`primary`/`ring`/`midground`/`composerRing` in both palettes). Also covers the CLI→desktop sync: mode persistence per profile, built-in/foreign skins, and the `display.skin` config watch (baseline on launch, apply on change, dispose). |
| `tests/hook.sh` | Skin YAML (22 keys, lowercase, 3-digit hex expansion), skip on unknown slug, exit 0 when `hermes` fails. |

Without `make`:

```bash
node --check desktop/plugin.js
python3 -m py_compile scripts/generate-themes.py
shellcheck hooks/hermes-skin-sync.sh tests/hook.sh
node tests/smoke.mjs
sh tests/hook.sh
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
│   └── stubs/                # @hermes/plugin-sdk, react, react/jsx-runtime
├── Makefile
└── README.md
```

The desktop plugin path (`desktop/plugin.js`) matches what the Hermes plugin loader looks for on `hermes plugins install <url>` (see `findDesktopEntry` in `desktop-plugin-install.ts`). Previously the plugin lived at `plugin/desktop/plugin.js` — the loader did not find it there and failed with "No agent or desktop plugin artifacts found".

Target paths after install:

| File | Destination |
|---|---|
| `desktop/plugin.js` | `~/.hermes/plugins/omarchy-themes/desktop/plugin.js` |
| `hooks/hermes-skin-sync.sh` | copy manually to `~/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh` |

---

## 🗺 Colour mapping

### Desktop theme

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

Missing keys fall back to `background`/`foreground`/`accent`. If any of these three is missing, the theme is skipped.

### CLI/TUI skin (hook)

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

The hook is pure POSIX `sh` with no Python dependency. A user theme takes precedence over a system theme with the same name. It always exits with code 0 so it never breaks Omarchy's hook chain.

---

## 🤖 How it was built

This project was designed and built by the **Hermes bot fleet** — kanban-driven with `coder`, `devops`, and `cicd`. The hook, desktop plugin, and generator were developed in separate tasks with independent verification; `tests/hook.sh` is the audit trail of the hook task.

---

## 🔒 Privacy

This repository is **private** and will remain so until a public release is explicitly authorised. This also applies to any mirror.
