# 🎨 omarchy-themes

<p align="center">
  <b>Brings Omarchy colour schemes to Hermes — desktop theme picker and CLI/TUI skin in one.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Themes-25-blueviolet?style=for-the-badge" alt="25 Themes">
  <img src="https://img.shields.io/badge/Tests-passing-brightgreen?style=for-the-badge" alt="Tests passing">
  <img src="https://img.shields.io/badge/shellcheck-passing-brightgreen?style=for-the-badge" alt="shellcheck">
  <img src="https://img.shields.io/badge/Repo-private-lightgrey?style=for-the-badge" alt="Private repo">
  <img src=".github/badges/ci.svg" alt="CI">
</p>

<p align="center">
  <a href="README.de.md">🇩🇪 Deutsche Version</a>
</p>

---

## 🧩 Components

| Component | File | What it does |
|---|---|---|
| **Desktop plugin** | `desktop/plugin.js` | Registers 25 themes (22 Omarchy stock themes + 3 custom ones with full palettes) in the Hermes theme picker, as ⌘K commands, and on a dedicated settings page. Purely local — no backend, no network. |
| **Theme sync hook** | `hooks/hermes-skin-sync.sh` | Runs on `omarchy theme set <slug>`, writes `~/.hermes/skins/<slug>.yaml` and activates the Hermes skin. CLI and TUI follow the desktop theme automatically. |
| **Generator** | `scripts/generate-themes.py` | Reads `colors.toml` files from the host and rewrites the theme table in the plugin — after Omarchy updates or for custom themes. |


---

## ⚡ Quick start

**Install via Hermes:**

```bash
hermes plugins install https://github.com/cabroe/omarchy-themes
```

Then: **⌘K → "Reload desktop plugins"** — the plugin is active out of the box (`defaultEnabled: true`). To disable it: Settings → Capabilities → Plugins → omarchy-themes → Toggle.

For the CLI/TUI hook, copy `hooks/hermes-skin-sync.sh` to `~/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh` and make it executable.

**Local requirements (for development):** Node ≥ 22, Python ≥ 3.11, `shellcheck`

```bash
make check            # lint + tests locally
```

---

## 🖥 Usage

- **Theme picker:** Omarchy themes appear alongside the built-in Hermes themes. Names that collide with a built-in (`catppuccin`, `everforest` …) get the suffix `-omarchy`.
- **⌘K:** `Apply Omarchy Theme: <name>`
- **Settings → Plugins → omarchy-themes:** Card view with colour swatches, filter (name/slug/`dark`/`light`) and an *Apply* button.
- **CLI/TUI:** `omarchy theme set nord` → hook writes skin → `hermes skin use nord` (live in ~1 s).

### What the plugin customises

Every registered theme ships **both** palettes + **both** terminal palettes + **typography**, so switching between light and dark mode in Hermes recolours the entire UI — not just the border:

| Field | Purpose |
|---|---|
| `colors` / `darkColors` | Background, card, popover, sidebar, input, border, primary/accent, muted, destructive, user bubble |
| `terminal` / `darkTerminal` | ANSI palette (black/white + 8 colours + bright variants) for the integrated terminal |
| `typography` | `fontSans` (system stack with emoji fallback), `fontMono` (JetBrains Mono stack) |

For the **opposite direction** (light variant of a dark theme or vice versa), the missing palette is synthesised in the plugin. The **surface seed** is `mixHex(c.background, '#ffffff' | '#000000', 0.88)` — the native background colour pulled 88% towards white or black. This ensures both palettes have genuine light/dark contrast and the renderer (`renderedModeFor` in `apps/desktop/src/themes/context.tsx`, Rec.709 luma > 0.5) reliably picks the right palette — even for Omarchy light themes like `lupine` (where `darker_background` is only a light grey) and dark themes like `nord` (where `lighter_background` is only slightly brighter black). Omarchy's `lighter_background` / `darker_background` are intentionally ignored because they sit too close to the original to cross the renderer threshold.

**Brand identity** is preserved: `accent`, `primary`, `ring`, `midground`, and `composerRing` are derived identically from `c.accent` in both palettes — so `lupine` is always lupine-blue and `nord` is always nord-cyan, regardless of light or dark mode.

Since **plugin hardening** ([t_3ca941bc]) + **theme mode sync**, every apply enforces the correct UI mode: `lupine` flips to light, `nord` stays dark. `setMode(entry.mode)` runs in addition to `requestTheme(name)` in the settings card apply path. For this to work outside React components (⌘K palette `palette.action`, `applyThemeFor(skin.changed)`), `requestMode` is needed in `@hermes/plugin-sdk` — follow-up task after the Hermes SDK update. Until then, ⌘K and CLI→desktop sync show hardening behaviour (no mode flip, but no lupine-as-dark either).

The test verifies this (see `tests/smoke.mjs`): for every registered theme, the luma difference between `colors.background` and `darkColors.background` must be ≥ 0.5 (aligned with the renderer threshold).

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
| `tests/smoke.mjs` | Plugin loads in Node and registers all themes, ⌘K commands, and the settings page. All colours are valid `#rrggbb`, no duplicate names. Enforces luma difference ≥ 0.5 between `colors` and `darkColors` (aligned with renderer threshold), completeness of 25 UI keys per palette, and brand consistency (identical `accent`/`primary`/`ring`/`midground`/`composerRing` in both palettes). |
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
