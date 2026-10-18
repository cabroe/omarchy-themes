<div align="center">

# 🎨 omarchy-themes

**Bringt die Omarchy-Farbschemata in Hermes — Desktop-Theme-Picker und CLI/TUI-Skin in einem.**

[![CI-Status](https://github.com/cabroe/omarchy-themes/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/cabroe/omarchy-themes/actions/workflows/ci.yml)

<sub>Badge: <code>make check</code> (Lint + Tests + shellcheck, Node 22 und LTS) auf <code>main</code>, direkt aus GitHub Actions. Die Theme-Zahl ist Build-abhängig (sie wächst mit Omarchy-Releases und mit <code>--include-user</code>) und wird deshalb bewusst nicht als statisches Badge gezeigt — die Live-Zahl für das aktuelle <code>desktop/plugin.js</code> gibt <code>node tests/smoke.mjs</code> aus.</sub>

[🇬🇧 English version](README.md)

</div>

---

## Inhalt

- [🧩 Komponenten](#-komponenten)
- [📦 Installation & Benutzung](#-installation--benutzung)
  - [🎯 Was du bekommst](#-was-du-bekommst)
  - [🛠 Was das Plugin anpasst](#-was-das-plugin-anpasst)
- [🔄 Themes aktualisieren](#-themes-aktualisieren)
- [🧪 Tests](#-tests)
  - [🔥 Live-Theme-Smoke](#-live-theme-smoke)
- [📁 Projektstruktur](#-projektstruktur)
- [🔬 Implementation Notes](#-implementation-notes)
- [🗺 Farb-Mapping](#-farb-mapping)
  - [🖥 Desktop-Theme](#-desktop-theme)
  - [⌨️ CLI/TUI-Skin (Hook)](#-clitui-skin-hook)
- [📄 Lizenz](#-lizenz)

---

## 🧩 Komponenten

- **Desktop-Plugin** (`desktop/plugin.js`) — Registriert alle Omarchy-Stock-Themes (zuzüglich beliebiger eigener Themes aus `~/.config/omarchy/themes/` bei Generierung mit `--include-user`, abzüglich der Hermes-Built-in-Kollisionen wie `catppuccin` / `everforest`) im Hermes-Theme-Picker, als ⌘K-Befehle und auf einer eigenen Settings-Seite. Die Zahl hängt davon ab, was Omarchy ausliefert und welche User-Themes installiert sind, und ist deshalb nirgends hartkodiert — die aktuelle Zahl für deinen Build liefert `node tests/smoke.mjs`. Rein lokal, kein Backend, kein Netzwerk.
- **Theme-Sync-Hook** (`hooks/hermes-skin-sync.sh`) — Läuft bei `omarchy theme set <slug>`, schreibt `~/.hermes/skins/<slug>.yaml` und aktiviert den Hermes-Skin. CLI und TUI folgen dem Desktop-Theme automatisch.
- **Generator** (`scripts/generate-themes.py`) — Liest `colors.toml`-Dateien vom Host und schreibt die Theme-Tabelle im Plugin neu — nach Omarchy-Updates oder für eigene Themes.

---

## 📦 Installation & Benutzung

**Installation über Hermes:**

```bash
hermes plugins install https://github.com/cabroe/omarchy-themes
```

Danach im Hermes-Desktop **⌘K → „Reload desktop plugins"**. Das Plugin ist opt-in — Hermes behandelt die Desktop-Hälfte eines Unified-Packages (Marker `.hermes-package.json`) unabhängig vom Plugin-eigenen Default als `defaultEnabled: false`. Einmal aktivieren: Settings → Capabilities → Plugins → omarchy-themes → Toggle (derselbe Toggle deaktiviert es wieder).

Für den CLI/TUI-Hook `make install-hook` ausführen — das installiert `hooks/hermes-skin-sync.sh` nach `~/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh` (idempotent, ein erneuter Lauf aktualisiert die Datei). Entfernen mit `make uninstall`.

**Lokale Voraussetzungen (Entwicklung):** Node ≥ 22, Python ≥ 3.11, `shellcheck`

```bash
make check              # Lint + Tests lokal
make install-githooks   # Pre-push-Hook aktivieren, der generate-check ausführt (optional)
```

### 🎯 Was du bekommst

- **Theme-Picker:** Die Omarchy-Themes erscheinen neben den eingebauten Hermes-Themes als `omarchy-<slug>`. Slugs, die mit einem Hermes-Built-in kollidieren (`catppuccin`, `everforest` …), werden übersprungen — das Built-in gewinnt als Source of Truth.
- **⌘K:** `Apply Omarchy Theme: <Name>`
- **Settings → Plugins → omarchy-themes:** Kartenansicht mit Farbswatches, Filter (Name/Slug/`dark`/`light`) und *Apply*-Button.
- **CLI/TUI:** `omarchy theme set nord` → der Desktop wechselt Theme **und** Hell/Dunkel-Modus nach ~0,6–0,8 s; der Hook zieht danach den Skin nach (~2,5–3,5 s). Vier Eingangspfade speisen einen Apply-Pfad: `~/.local/state/omarchy/current/theme.name` (Datei-Watch), `display.skin` in der lokalen `<HERMES_HOME>/config.yaml`, das Gateway-Event `skin.changed` sowie `current/theme/colors.toml` selbst (bewaffnet sich nach jedem Event neu). Wiederholungen desselben Namens innerhalb von 15 s sind No-Ops. Das Plugin merkt sich das zuletzt gesehene Theme, sodass ein verspätetes Nachholen beim Start funktioniert; der Omarchy-Toggle `~/.local/state/omarchy/toggles/skip-hermes-theme-changes` stoppt jedes automatische Umschalten (Picker und ⌘K funktionieren weiter).
- **Plugin-Themes heißen `omarchy-<slug>`, CLI-Skins `<slug>`:** das Präfix verhindert, dass ein einmal aktiver CLI-Skin seine Ein-Paletten-Konvertierung über das Hell/Dunkel-Paar des Plugins zeichnet (`resolveTheme` bevorzugt Backend-Skin-Themes). Nach einem CLI-Wechsel kann der Picker „Nord" und „Omarchy Nord" auflisten — nimm die Omarchy-Variante.
- **Unbekannte Themes** (User-installiert oder neuer als `make generate`): Das Plugin liest `~/.local/state/omarchy/current/theme/colors.toml` und registriert **einen** austauschbaren `omarchy-current`-Eintrag (Label „Omarchy <slug>"). Omarchys eigener Skin `omarchy` (`omarchy-theme-set-hermes`) zählt ebenfalls als „aktuelles Omarchy-Theme".

### 🛠 Was das Plugin anpasst

Jedes registrierte Theme liefert **beide** Paletten + **beide** Terminal-Paletten + **Typography**, damit der Wechsel zwischen Light- und Dark-Mode in Hermes die ganze UI neu einfärbt — nicht nur die Border:

| Feld | Wofür |
|---|---|
| `colors` / `darkColors` | Hintergrund, Card, Popover, Sidebar, Input, Border, Primary/Accent, Muted, Destructive, User-Bubble. Beide Paletten teilen denselben Marken-`accent`/`primary`/`ring`/`midground`/`composerRing`; die Gegenpalette wird automatisch synthetisiert, damit jedes Theme echten Hell/Dunkel-Kontrast hat (Rec.709-Luma ≥ 0,5 zwischen `colors.background` und `darkColors.background`). Siehe [Implementation Notes](#-implementation-notes). |
| `terminal` / `darkTerminal` | ANSI-Palette (schwarz/weiß + 8 Farben + Bright-Varianten) fürs integrierte Terminal |
| `typography` | `fontSans` (System-Stack mit Emoji-Fallback), `fontMono` (JetBrains-Mono-Stack) |

---

## 🔄 Themes aktualisieren

Die Paletten sind ins Plugin eingebacken (der Desktop-Renderer hat keinen Dateisystemzugriff). Nach einem Omarchy-Update `make generate` ausführen (`HOST=<ssh-Host>` liest per SSH) oder `make generate-check` für eine Drift-Prüfung ohne Schreiben. Eigene Themes mit `python3 scripts/generate-themes.py --include-user` einbeziehen. Der Generator ersetzt nur den Block zwischen `// BEGIN GENERATED THEMES` und `// END GENERATED THEMES`, ist deterministisch und löst Themes ohne eigene `colors.toml` (nur `alacritty.toml`) über Omarchys eigene CLI-Werkzeuge `omarchy-theme-colors-from-alacritty` / `omarchy-theme-color` auf.

---

## 🧪 Tests

```bash
make check    # = lint + test
make test     # node tests/smoke.mjs && sh tests/hook.sh
make lint     # node --check + py_compile + shellcheck
```

| Test | Prüft |
|---|---|
| `tests/smoke.mjs` | Plugin lädt in Node und registriert alle Themes, ⌘K-Befehle (jeweils mit `label` + `run`, sonst blendet der Host sie aus) und Settings-Seite. Alle Farben sind gültiges `#rrggbb`, kein Name doppelt, alle Desktop-Namen mit `omarchy-`-Präfix. Erzwingt Luma-Differenz ≥ 0,5 zwischen `colors` und `darkColors` (deckungsgleich mit Renderer-Threshold ≥ 0,5), Vollständigkeit von 25 UI-Schlüsseln pro Palette und Markentreue (identischer `accent`/`primary`/`ring`/`midground`/`composerRing` in beiden Paletten). Deckt außerdem den CLI→Desktop-Sync ab: Modus pro Profil, eingebaute und fremde Skins, erneutes Anwenden nach Hermes' eigener Skin-Verarbeitung sowie die `display.skin`-Überwachung (Baseline vs. Nachholen beim Start, Anwenden bei Änderung, Dispose). |
| `tests/hook.sh` | Skin-YAML (22 Keys, Kleinschreibung, 3-stellige Hex-Expansion), Skip bei unbekanntem Slug, Exit 0 wenn `hermes` fehlschlägt, Fallback auf die von Omarchy erzeugte colors.toml bei Themes ohne eigene, Modus aus der Hintergrund-Helligkeit. |
| `tests/generate_themes_test.py` | Stdlib-`unittest` für `scripts/generate-themes.py`: `norm_hex` (3-/6-stellig, Kleinschreibung, ungültig), `parse_palette` (kaputtes TOML, fehlendes `background`, fehlende ANSI, 3- und 6-stellige Hex-Normalisierung, `mode`-Behandlung inkl. Default bei Abwesenheit, zusätzliche Keys ignoriert), `read_local` (Slug-Erkennung, fehlendes Verzeichnis, Sortierung), `parse_sections` (einfach, mehrfach, leer), `render` (Marker-Vertrag) und `main()`-Exit-Codes (0/1/2) mit `TemporaryDirectory`-Fixtures — inklusive User-Theme-Override bei Slug-Kollision (`--include-user`). |
| `tests/theme-switch-smoke.sh` | Live: echtes `omarchy theme set` durch die Hook-Kette per SSH (`make theme-smoke`). Deckt nur die CLI/TUI-Skin-Pipeline ab, nicht das Desktop-Plugin; nicht Teil von `make check`. |

### 🔥 Live-Theme-Smoke

`tests/theme-switch-smoke.sh` läuft `omarchy theme set` gegen einen echten Omarchy-Host — Stock-Themes, User-Themes, die echte Hook-Kette. Er ist **nicht** Teil von `make check`, weil er User-State mutiert (aktiver Skin, `~/.hermes/skins/*.yaml`).

Lokal:

```bash
make theme-smoke HOST=omarchy    # omarchy = Host in deiner ~/.ssh/config
```

In CI: `.github/workflows/live-theme-smoke.yml` ruft dasselbe Target auf dem omarchy-Self-hosted-GitHub-Actions-Runner (`runs-on: [self-hosted, omarchy, omarchy-themes]`) auf. Trigger:

- `workflow_dispatch` — manuell, `gh workflow run live-theme-smoke.yml`
- `schedule: '0 4 * * 0'` — Sonntag 04:00 UTC, fängt Omarchy-seitige Drift
- `push` auf `main`, wenn `tests/theme-switch-smoke.sh`, `hooks/hermes-skin-sync.sh` oder die Workflow-Datei selbst geändert wird

Der Runner ist eine **dedizierte, Label-gepinnte** Installation auf der omarchy-Workstation (siehe `SECURITY.md`). Er läuft nicht 24/7: vor dem Trigger starten, danach stoppen. Der Job hat keine Secrets — nur `contents: read`.

Gleiches Ergebnis ohne `make`:

```bash
node --check desktop/plugin.js
python3 -m py_compile scripts/generate-themes.py
shellcheck hooks/hermes-skin-sync.sh tests/hook.sh
node tests/smoke.mjs
sh tests/hook.sh
python3 -m unittest tests/generate_themes_test.py
```

---

## 📁 Projektstruktur

```
omarchy-themes/
├── desktop/plugin.js         # Hermes-Desktop-Plugin (plain ESM, kein Build)
├── hooks/hermes-skin-sync.sh # Omarchy-theme-set-Hook → Hermes CLI/TUI-Skin
├── scripts/
│   └── generate-themes.py    # colors.toml → Theme-Tabelle in plugin.js
├── tests/
│   ├── smoke.mjs             # Plugin in Node mit SDK-Stubs
│   ├── hook.sh               # Hook gegen Fixture in Sandbox-$HOME
│   ├── theme-switch-smoke.sh # Live-Test der Hook-Kette per SSH (`make theme-smoke`, nicht in `make check`)
│   └── stubs/                # @hermes/plugin-sdk, react, react/jsx-runtime
├── .github/                  # CI-Workflow, Issue-/PR-Templates, Dependabot
├── .githooks/pre-push        # generate-check vor jedem Push (`make install-githooks`)
├── Makefile
├── CHANGELOG.md  LICENSE  SECURITY.md  CONTRIBUTING.md
└── README.md
```

Der Desktop-Plugin-Pfad (`desktop/plugin.js`) entspricht dem, was der Hermes-Plugin-Loader beim `hermes plugins install <url>` sucht (siehe `findDesktopEntry` in `desktop-plugin-install.ts`). Früher lag das Plugin unter `plugin/desktop/plugin.js` — der Loader hat dort nichts erkannt und brach mit „No agent or desktop plugin artifacts found" ab.

Zielpfade nach Installation:

| Datei | Ziel |
|---|---|
| `desktop/plugin.js` | `~/.hermes/plugins/omarchy-themes/desktop/plugin.js` |
| `hooks/hermes-skin-sync.sh` | manuell kopieren nach `~/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh` |

---

## 🔬 Implementation Notes

Warum ein eigener Mixer statt Omarchy's eigenem `lighter_background` / `darker_background`?
Omarchy's „lighter" eines Dark-Themes ist immer noch dunkel-grau (`nord` `#3b4252`, Luma ≈ 0,18),
und das „darker" eines Light-Themes ist immer noch hell-grau (`lupine` `#dedede`, Luma ≈ 0,87).
Der Renderer (`renderedModeFor` in `apps/desktop/src/themes/context.tsx`) wertet die Surface-Luma
gegen 0,5 aus und entscheidet davon abhängig Light vs. Dark — Omarchy's eigene Varianten
bleiben damit auf der falschen Seite des Schwellwerts und der UI-Modus flippt nie.

Das Plugin synthetisiert die fehlende Palette mit
`mixHex(c.background, '#000' | '#fff', 0.88)` — den nativen Hintergrund um 88 %
Richtung Schwarz (für die Dark-Variante eines Light-Themes) oder Weiß (für die
Light-Variante eines Dark-Themes) gezogen. Der `tests/smoke.mjs`-Luma-Test
erzwingt den ≥ 0,5-Schwellwert für jedes registrierte Theme.

Die Marken-Identität bleibt erhalten, weil `accent` / `primary` / `ring` /
`midground` / `composerRing` in beiden Paletten aus demselben Omarchy-`accent`
abgeleitet werden — `lupine` ist immer lupine-blau und `nord` immer nord-cyan,
egal in welchem Modus. Siehe `desktop/plugin.js` (`synthLightFromDark` /
`synthDarkFromLight`).

Die einzigen Stellschrauben, die dieses Plugin nach außen legt, sind
`SURFACE_MIX_AMOUNT` (0,88) und `ACCENT_TEXT_LUMA` (0,55) am Anfang der
Color-Helpers-Sektion in `plugin.js` — beides benannte Konstanten, damit
die renderer-seitigen Zahlen per Code-Suche direkt bei ihrer Definition
landen.

---

## 🗺 Farb-Mapping

### 🖥 Desktop-Theme

| `colors.toml` | Hermes `DesktopTheme` |
|---|---|
| `background` | `background`, `terminal.black`, `terminal.brightBlack` |
| `foreground` | `foreground` + alle `*Foreground`, `terminal.foreground/cursor/brightWhite` |
| `accent` | `primary`, `accent`, `ring`, `midground`, `composerRing`; Textfarbe darauf (weiß/schwarz) per Luminanz |
| `lighter_background` | `card`, `popover`, `secondary`, `userBubble` |
| `dark_background` | `border`, `input`, `sidebarBackground`, `sidebarBorder`, `userBubbleBorder` |
| `muted` / `dark_foreground` | `muted` / `mutedForeground` |
| `red` | `destructive` |
| `selection` | `terminal.selectionBackground` |
| `red…magenta`, `bright_*` | `terminal.*` / `terminal.bright*` |
| `mode = "light"` | zusätzlich `darkColors`/`darkTerminal` aus `dark_background`/`darker_background` |

Fehlende Keys fallen auf `background`/`foreground`/`accent` zurück. Fehlt einer dieser drei, wird das Theme übersprungen. Ist `lighter_background` gleich `background` (Omarchy leitet das für Themes ohne Flächentöne so ab, z. B. aetheria, ayaka, cpunk, last-horizon, solitude), werden Karten und Popover um wenige Prozent vom Seitenhintergrund abgehoben; ist `dark_background` gleich `background` (hermarchy, omacarchy), wird auch der Sidebar-/Border-Ton angehoben, damit Sidebar und Rahmen sichtbar bleiben.

### ⌨️ CLI/TUI-Skin (Hook)

Der Hook schreibt 22 Keys; alles Weitere erbt der Skin-Loader vom `default`-Skin.

| `colors.toml` | `~/.hermes/skins/<slug>.yaml` |
|---|---|
| `background` | `background` |
| `foreground` | `banner_title`, `banner_text`, `ui_text`, `prompt`, `status_bar_text` |
| `accent` | `ui_accent`, `banner_accent`, `input_rule` |
| `dark_background` | `banner_border`, `ui_border`, `status_bar_bg`, `session_border` |
| `muted` | `banner_dim` |
| `green` / `yellow` / `red` | `ui_ok/warn/error`, `status_bar_good/warn/critical` |
| `cyan` | `response_border`, `session_label` |

Der Hook ist reines POSIX-`sh` ohne Python. Ein User-Theme hat Vorrang vor dem gleichnamigen System-Theme. Er beendet sich immer mit Exit 0, damit Omarchys Hook-Kette nie abbricht. Für Themes ohne eigene `colors.toml` fällt der Hook auf die `colors.toml` zurück, die Omarchy für das gerade angewendete Theme erzeugt hat (`~/.local/state/omarchy/current/theme/`, nur solange `theme.name` passt), inklusive der `colorN`-Namen.

---

## 📄 Lizenz

[MIT](LICENSE). Änderungen stehen im [Changelog](CHANGELOG.md); siehe [CONTRIBUTING.md](CONTRIBUTING.md) und [SECURITY.md](SECURITY.md).