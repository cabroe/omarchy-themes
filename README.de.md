<div align="center">

# 🎨 omarchy-themes

**Omarchy-Paletten, Hermes-nativ — ein `theme set`, Desktop-Picker + CLI + TUI wechseln synchron.**

[![en](https://img.shields.io/badge/lang-en-blue.svg)](README.md)
[![de](https://img.shields.io/badge/lang-de-blue.svg)](README.de.md)

[![CI-Status](https://github.com/cabroe/omarchy-themes/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/cabroe/omarchy-themes/actions/workflows/ci.yml)

</div>

---

## Inhalt

- [🧩 Komponenten](#-komponenten)
- [📦 Installation & Benutzung](#-installation--benutzung)
- [🔄 Themes aktualisieren](#-themes-aktualisieren)
- [🧪 Tests](#-tests)
- [📁 Projektstruktur](#-projektstruktur)
- [🔬 Implementation Notes](#-implementation-notes)
- [🗺 Farb-Mapping](#-farb-mapping)
- [📄 Lizenz](#-lizenz)

---

## 🧩 Komponenten

- **Desktop-Plugin** (`desktop/plugin.js`) — Registriert Omarchy-Themes (Stock + User via `--include-user`, minus Hermes-Built-in-Kollisionen) im Theme-Picker, als ⌘K-Befehle und auf einer Settings-Seite.
- **Theme-Sync-Hook** (`hooks/hermes-skin-sync.sh`) — Läuft bei `omarchy theme set <slug>`, schreibt `~/.hermes/skins/<slug>.yaml` und aktiviert den Hermes-Skin.
- **Generator** (`scripts/generate-themes.py`) — Liest `colors.toml`-Dateien und schreibt die Theme-Tabelle im Plugin neu nach Omarchy-Updates.

---

## 📦 Installation & Benutzung

`hermes plugins install https://github.com/cabroe/omarchy-themes`, dann **⌘K → „Reload desktop plugins"**. Einmal aktivieren: Settings → Capabilities → Plugins → omarchy-themes → Toggle.

Für den CLI/TUI-Hook: `make install-hook` (idempotent); `make uninstall` entfernt sie.

**Entwicklung:** Node ≥ 22, Python ≥ 3.11, `shellcheck`. `make check` = Lint + Tests; `make install-githooks` aktiviert Pre-push-Check.

**Was du bekommst:**
- Omarchy-Themes als `omarchy-<slug>` im Picker, ⌘K (`Apply Omarchy Theme: <Name>`) und Settings-Kartenansicht mit Swatches/Filter/*Apply*.
- `omarchy theme set nord` wechselt Desktop-Theme **und** Hell/Dunkel-Modus; Hook synchronisiert CLI/TUI-Skin (~3 s Verzögerung, 15-s-No-Op-Fenster). `~/.local/state/omarchy/toggles/skip-hermes-theme-changes` deaktiviert Auto-Switching.
- Jedes Theme liefert **beide** Paletten + **beide** Terminal-Paletten + Typography — Light/Dark-Wechsel färbt die ganze UI neu. Beide Paletten teilen Marken-`accent`/`primary`/`ring`; Gegenpalette wird auto-synthetisiert (Rec.709-Luma ≥ 0,5-Kontrast).
- Unbekannte Themes (User-installiert oder neuer als `make generate`): Plugin liest `~/.local/state/omarchy/current/theme/colors.toml` und registriert **einen** `omarchy-current`-Fallback.

---

## 🔄 Themes aktualisieren

Nach einem Omarchy-Update: `make generate` (`HOST=<ssh-Host>` liest per SSH) oder `make generate-check` (Drift-Prüfung). Eigene Themes: `python3 scripts/generate-themes.py --include-user`. Generator ersetzt nur den `// BEGIN GENERATED THEMES` … `// END GENERATED THEMES`-Block, ist deterministisch, löst Themes ohne `colors.toml` über `omarchy-theme-colors-from-alacritty` / `omarchy-theme-color` auf.

---

## 🧪 Tests

```bash
make check    # = lint + test
make test     # node tests/smoke.mjs && sh tests/hook.sh
make lint     # node --check + py_compile + shellcheck
```

- **`tests/smoke.mjs`** — Plugin lädt, registriert Themes/Befehle/Settings, Farben gültig, Luma/Marke/Präfix erzwungen, CLI→Desktop-Sync abgedeckt.
- **`tests/hook.sh`** — Skin-YAML (22 Keys, 3-stelliges Hex), Skip bei unbekannt, Exit 0 bei Fehler, Fallback auf Omarchy-erzeugte `colors.toml`.
- **`tests/theme-switch-smoke.sh`** — Live `omarchy theme set` per SSH (`make theme-smoke HOST=omarchy`). Mutiert User-State; nicht in `make check`.

CI: `.github/workflows/live-theme-smoke.yml` führt Smoke auf Self-hosted-omarchy-Runner aus (manuell `workflow_dispatch`, sonntags 04:00 UTC, `push` auf `main` wenn Smoke/Hook/Workflow ändern). Dediziert, Label-gepinnt; vor Trigger starten, danach stoppen.

---

## 📁 Projektstruktur

```
omarchy-themes/
├── desktop/plugin.js         # Hermes-Desktop-Plugin (plain ESM)
├── hooks/hermes-skin-sync.sh # Omarchy-theme-set-Hook → Hermes CLI/TUI-Skin
├── scripts/generate-themes.py  # colors.toml → Theme-Tabelle in plugin.js
├── tests/{smoke.mjs,hook.sh,theme-switch-smoke.sh,stubs/}
├── .github/workflows/        # CI: ci.yml, live-theme-smoke.yml
├── .githooks/pre-push        # generate-check-Guard
└── Makefile
```

Install-Ziel: `~/.hermes/plugins/omarchy-themes/desktop/plugin.js` (auto), `~/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh` (manuell `make install-hook`).

---

## 🔬 Implementation Notes

Omarchys `lighter_background` / `darker_background` bleiben auf der falschen Seite des Renderer-Luma-Schwellwerts (0,5), also flippt der UI-Modus nie. Plugin synthetisiert fehlende Palette mit `mixHex(c.background, '#000'|'#fff', 0.88)` (siehe `SURFACE_MIX_AMOUNT` / `ACCENT_TEXT_LUMA` in `desktop/plugin.js`). Marken-Identität bleibt: `accent`/`primary`/`ring`/`midground`/`composerRing` stammen aus demselben Omarchy-`accent` in beiden Paletten.

---

## 🗺 Farb-Mapping

### Desktop-Theme

`accent` → `primary`/`accent`/`ring`/`midground`/`composerRing` (Text darauf per Luminanz); `lighter_background` → `card`/`popover`/`secondary`/`userBubble`; `dark_background` → `border`/`input`/`sidebarBackground`/`sidebarBorder`/`userBubbleBorder`; `selection` → `terminal.selectionBackground`; `mode="light"` → zusätzlich `darkColors`/`darkTerminal`. Andere Keys (`background`, `foreground`, `muted`, `red`, ANSI) gehen 1:1 durch. Fehlende Keys fallen auf `background`/`foreground`/`accent` zurück. Ist `lighter_background` oder `dark_background` gleich `background`, um wenige Prozent für Sichtbarkeit angehoben. Vollständiges Mapping: siehe `desktop/plugin.js` (`synthLightFromDark` / `synthDarkFromLight`).

### CLI/TUI-Skin (Hook)

22 Keys geschrieben; Rest vom `default`-Skin geerbt. `accent` → `ui_accent`/`banner_accent`/`input_rule`; `dark_background` → `banner_border`/`ui_border`/`status_bar_bg`/`session_border`; `green`/`yellow`/`red` → `ui_ok`/`warn`/`error`, `status_bar_good`/`warn`/`critical`; `cyan` → `response_border`/`session_label`. Andere Keys 1:1. Reines POSIX-`sh`, kein Python. User-Theme schlägt System-Theme. Exit 0 immer. Fallback: Omarchy-erzeugte `~/.local/state/omarchy/current/theme/colors.toml`.

---

## 📄 Lizenz

[MIT](LICENSE). Änderungen in [CHANGELOG.md](CHANGELOG.md); siehe [CONTRIBUTING.md](CONTRIBUTING.md) und [SECURITY.md](SECURITY.md).
