# 🎨 omarchy-themes

<p align="center">
  <b>Bringt die Omarchy-Farbschemata in Hermes — Desktop-Theme-Picker und CLI/TUI-Skin in einem.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Themes-25-blueviolet?style=for-the-badge" alt="25 Themes">
  <img src="https://img.shields.io/badge/Tests-passing-brightgreen?style=for-the-badge" alt="Tests passing">
  <img src="https://img.shields.io/badge/shellcheck-passing-brightgreen?style=for-the-badge" alt="shellcheck">
  <img src="https://img.shields.io/badge/Deploy-SSH-blue?style=for-the-badge" alt="Deploy via SSH">
  <img src="https://img.shields.io/badge/Repo-privat-lightgrey?style=for-the-badge" alt="Privates Repo">
  <img src="https://github.com/cabroe/omarchy-themes/actions/workflows/ci.yml/badge.svg" alt="CI">
</p>

---

## 🧩 Komponenten

| Komponente | Datei | Was sie tut |
|---|---|---|
| **Desktop-Plugin** | `desktop/plugin.js` | Registriert 25 Themes (22 Omarchy-Stock-Themes + 3 eigene mit vollständiger Palette) im Hermes-Theme-Picker, als ⌘K-Befehle und auf einer eigenen Settings-Seite. Rein lokal, kein Backend, kein Netzwerk. |
| **Theme-Sync-Hook** | `hooks/hermes-skin-sync.sh` | Läuft bei `omarchy theme set <slug>`, schreibt `~/.hermes/skins/<slug>.yaml` und aktiviert den Hermes-Skin. CLI und TUI folgen dem Desktop-Theme automatisch. |
| **Generator** | `scripts/generate-themes.py` | Liest `colors.toml`-Dateien vom Host und schreibt die Theme-Tabelle im Plugin neu — nach Omarchy-Updates oder für eigene Themes. |
| **Deploy-Script** | `scripts/deploy.sh` | Kopiert Plugin + Hook per `scp` auf den Zielhost und vergleicht Byte für Byte. |

---

## ⚡ Schnellstart

```bash
make check            # Lint + Tests lokal (kein Host nötig)
make deploy           # check → Plugin + Hook nach omarchy deployen
make deploy HOST=foo  # anderen SSH-Host verwenden
```

Danach im Hermes-Desktop **⌘K → „Reload desktop plugins"** — das Plugin ist ab Werk aktiv (`defaultEnabled: true`). Wer es deaktivieren will: Settings → Capabilities → Plugins → Omarchy Themes → Toggle.

**Voraussetzungen lokal:** Node ≥ 22, Python ≥ 3.11, `shellcheck`
**Voraussetzungen auf dem Host:** SSH-Zugang, Omarchy, Hermes

---

## 🖥 Benutzung

- **Theme-Picker:** Die Omarchy-Themes erscheinen neben den eingebauten Hermes-Themes. Namen, die mit einem Built-in kollidieren (`catppuccin`, `everforest` …), bekommen das Suffix `-omarchy`.
- **⌘K:** `Apply Omarchy Theme: <Name>`
- **Settings → Plugins → Omarchy Themes:** Kartenansicht mit Farbswatches, Filter (Name/Slug/`dark`/`light`) und *Apply*-Button.
- **CLI/TUI:** `omarchy theme set nord` → Hook schreibt Skin → `hermes skin use nord` (live in ~1 s).

### Was das Plugin anpasst

Jedes registrierte Theme liefert **beide** Paletten + **beide** Terminal-Paletten + **Typography**, damit der Wechsel zwischen Light- und Dark-Mode in Hermes die ganze UI neu einfärbt — nicht nur die Border:

| Feld | Wofür |
|---|---|
| `colors` / `darkColors` | Hintergrund, Card, Popover, Sidebar, Input, Border, Primary/Accent, Muted, Destructive, User-Bubble |
| `terminal` / `darkTerminal` | ANSI-Palette (schwarz/weiß + 8 Farben + Bright-Varianten) fürs integrierte Terminal |
| `typography` | `fontSans` (System-Stack mit Emoji-Fallback), `fontMono` (JetBrains Mono-Stack) |

Für die **Gegenrichtung** (Light-Variante eines Dark-Themes oder umgekehrt) wird die fehlende Palette im Plugin synthetisiert. **Surface-Seed** ist jeweils `mixHex(c.background, '#ffffff' | '#000000', 0.88)` — also die native BG-Farbe um 88 % Richtung Weiß oder Schwarz gezogen. Das stellt sicher, dass beide Paletten echten Hell/Dunkel-Kontrast haben und der Renderer (`renderedModeFor` in `apps/desktop/src/themes/context.tsx`, Rec.709-Luma > 0.5) zuverlässig die richtige Palette wählt — selbst bei Omarchy-Light-Themes wie `lupine` (für die `darker_background` nur leichtes Grau ist) und Omarchy-Dark-Themes wie `nord` (für die `lighter_background` nur leicht helleres Schwarz ist). Omarchy's `lighter_background` / `darker_background` werden bewusst ignoriert, weil sie für den Renderer-Schwellwert zu nah am Original liegen.

**Marken-Identität** bleibt erhalten: `accent`, `primary`, `ring`, `midground`, `composerRing` werden in beiden Paletten identisch aus `c.accent` abgeleitet — `lupine` ist also immer lupine-blau, `nord` immer nord-cyan, egal ob Light- oder Dark-Mode.

Seit **Plugin-Hardening** ([t_3ca941bc]) + **Theme-Mode-Sync** (diese Task) erzwingt jeder Apply den passenden UI-Modus: `lupine` flipt zu Light, `nord` bleibt Dark. `setMode(entry.mode)` läuft zusätzlich zu `requestTheme(name)` im Apply-Pfad der Settings-Karte. Damit das auch außerhalb von React-Komponenten funktioniert (⌘K-Palette-`palette.action`, `applyThemeFor(skin.changed)`), braucht es `requestMode` im `@hermes/plugin-sdk` — Folge-Task für nach dem Hermes-SDK-Update. Bis dahin zeigen ⌘K und CLI→Desktop-Sync das Hardening-Verhalten (kein Mode-Flip, aber auch kein Lupine-als-Dark mehr).

Der Test prüft das (siehe `tests/smoke.mjs`): für jedes registrierte Theme muss die Luma-Differenz zwischen `colors.background` und `darkColors.background` ≥ 0,5 sein (deckungsgleich mit dem Renderer-Threshold).

---

## 🔄 Themes aktualisieren

Die Paletten sind ins Plugin eingebacken (der Desktop-Renderer hat keinen Dateisystemzugriff). Nach einem Omarchy-Update:

```bash
make generate          # Paletten vom Host neu einlesen und plugin.js überschreiben
make generate-check    # nur prüfen, ob plugin.js aktuell ist (Exit 1 wenn nicht)
make deploy
```

Eigene Themes aus `~/.config/omarchy/themes/` einschließen:

```bash
python3 scripts/generate-themes.py --remote omarchy --include-user
```

Der Generator ersetzt nur den Block zwischen `// BEGIN GENERATED THEMES` und `// END GENERATED THEMES` und ist deterministisch — kein Diff, wenn sich nichts geändert hat.

---

## 🧪 Tests

```bash
make check    # = lint + test
make test     # node tests/smoke.mjs && sh tests/hook.sh
make lint     # node --check + py_compile + shellcheck
```

| Test | Prüft |
|---|---|
| `tests/smoke.mjs` | Plugin lädt in Node und registriert alle Themes, ⌘K-Befehle und Settings-Seite. Alle Farben sind gültiges `#rrggbb`, kein Name doppelt. Erzwingt Luma-Differenz ≥ 0,5 zwischen `colors` und `darkColors` (deckungsgleich mit Renderer-Threshold ≥ 0,5), Vollständigkeit von 25 UI-Schlüsseln pro Palette und Markentreue (identischer `accent`/`primary`/`ring`/`midground`/`composerRing` in beiden Paletten). |
| `tests/hook.sh` | Skin-YAML (22 Keys, Kleinschreibung, 3-stellige Hex-Expansion), Skip bei unbekanntem Slug, Exit 0 wenn `hermes` fehlschlägt. |

Gleiches Ergebnis ohne `make`:

```bash
node --check desktop/plugin.js
python3 -m py_compile scripts/generate-themes.py
shellcheck hooks/hermes-skin-sync.sh scripts/deploy.sh tests/hook.sh
node tests/smoke.mjs
sh tests/hook.sh
```

---

## 📁 Projektstruktur

```
omarchy-themes/
├── desktop/plugin.js         # Hermes-Desktop-Plugin (plain ESM, kein Build)
├── hooks/hermes-skin-sync.sh # Omarchy-theme-set-Hook → Hermes CLI/TUI-Skin
├── scripts/
│   ├── generate-themes.py    # colors.toml → Theme-Tabelle in plugin.js
│   └── deploy.sh             # scp + Byte-Vergleich auf dem Zielhost
├── tests/
│   ├── smoke.mjs             # Plugin in Node mit SDK-Stubs
│   ├── hook.sh               # Hook gegen Fixture in Sandbox-$HOME
│   └── stubs/                # @hermes/plugin-sdk, react, react/jsx-runtime
├── Makefile
└── README.md
```

Der Desktop-Plugin-Pfad (`desktop/plugin.js`) entspricht dem, was der Hermes-Plugin-Loader beim
`hermes plugins install <url>` sucht (siehe `findDesktopEntry` in
`desktop-plugin-install.ts`). Früher lag das Plugin unter `plugin/desktop/plugin.js` — der
Loader hat dort nichts erkannt und brach mit „No agent or desktop plugin artifacts found"
ab.

Zielpfade auf dem Host (per `make deploy`):

| Datei | Ziel |
|---|---|
| `desktop/plugin.js` | `~/.hermes/plugins/omarchy-themes/desktop/plugin.js` |
| `hooks/hermes-skin-sync.sh` | `~/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh` |

---

## 🗺 Farb-Mapping

### Desktop-Theme

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

Fehlende Keys fallen auf `background`/`foreground`/`accent` zurück. Fehlt einer dieser drei, wird das Theme übersprungen.

### CLI/TUI-Skin (Hook)

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

Der Hook ist reines POSIX-`sh` ohne Python. Ein User-Theme hat Vorrang vor dem gleichnamigen System-Theme. Er beendet sich immer mit Exit 0, damit Omarchys Hook-Kette nie abbricht.

---

## 🤖 Entstehung

Dieses Projekt wurde von der **Hermes-Bot-Flotte** entworfen und gebaut — Kanban-gesteuert mit `coder`, `devops` und `cicd`. Hook, Desktop-Plugin und Generator entstanden in getrennten Tasks mit unabhängiger Verifikation; `tests/hook.sh` ist der Audit-Trail des Hook-Tasks.

---

## 🔒 Privatheit

Das Repo ist **privat** und bleibt es, bis eine Veröffentlichung ausdrücklich freigegeben wird. Das gilt auch für jeden Mirror.
