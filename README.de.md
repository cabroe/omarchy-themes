# 🎨 omarchy-themes

<p align="center">
  <b>Bringt die Omarchy-Farbschemata in Hermes — Desktop-Theme-Picker und CLI/TUI-Skin in einem.</b>
</p>

<p align="center">
  <a href=".github/workflows/ci.yml"><img src=".github/badges/ci.svg" alt="CI-Status"></a>
</p>

<p align="center"><sub>Einziges Live-Badge: <code>make check</code> (Lint + Tests + shellcheck) auf <code>main</code>, automatisch vom <a href=".github/workflows/ci.yml"><code>badge</code>-Job</a> aktualisiert. Die Theme-Zahl ist Build-abhängig (sie wächst mit Omarchy-Releases und mit <code>--include-user</code>) und wird deshalb bewusst nicht als statisches Badge gezeigt — die Live-Zahl für das aktuelle <code>desktop/plugin.js</code> gibt <code>node tests/smoke.mjs</code> aus.</sub></p>

<p align="center">
  <a href="README.md">🇬🇧 English version</a>
</p>

---

## 🧩 Komponenten

| Komponente | Datei | Was sie tut |
|---|---|---|
| **Desktop-Plugin** | `desktop/plugin.js` | Registriert alle Omarchy-Stock-Themes (zuzüglich beliebiger eigener Themes aus `~/.config/omarchy/themes/` bei Generierung mit `--include-user`, abzüglich der Hermes-Built-in-Kollisionen wie `catppuccin` / `everforest`) im Hermes-Theme-Picker, als ⌘K-Befehle und auf einer eigenen Settings-Seite. Die Zahl hängt davon ab, was Omarchy ausliefert und welche User-Themes installiert sind, und ist deshalb nirgends hartkodiert — die aktuelle Zahl für deinen Build liefert `node tests/smoke.mjs`. Rein lokal, kein Backend, kein Netzwerk. |
| **Theme-Sync-Hook** | `hooks/hermes-skin-sync.sh` | Läuft bei `omarchy theme set <slug>`, schreibt `~/.hermes/skins/<slug>.yaml` und aktiviert den Hermes-Skin. CLI und TUI folgen dem Desktop-Theme automatisch. |
| **Generator** | `scripts/generate-themes.py` | Liest `colors.toml`-Dateien vom Host und schreibt die Theme-Tabelle im Plugin neu — nach Omarchy-Updates oder für eigene Themes. |

---

## ⚡ Schnellstart

**Installation über Hermes:**

```bash
hermes plugins install https://github.com/cabroe/omarchy-themes
```

Danach im Hermes-Desktop **⌘K → „Reload desktop plugins"** — das Plugin ist ab Werk aktiv (`defaultEnabled: true`). Wer es deaktivieren will: Settings → Capabilities → Plugins → omarchy-themes → Toggle.

Für den CLI/TUI-Hook `make install-hook` ausführen — das installiert `hooks/hermes-skin-sync.sh` nach `~/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh` (idempotent, ein erneuter Lauf aktualisiert die Datei). Entfernen mit `make uninstall`.

**Voraussetzungen lokal (für Entwicklung):** Node ≥ 22, Python ≥ 3.11, `shellcheck`

```bash
make check            # Lint + Tests lokal
```

---

## 🖥 Benutzung

- **Theme-Picker:** Die Omarchy-Themes erscheinen neben den eingebauten Hermes-Themes. Namen, die mit einem Hermes-Built-in kollidieren (`catppuccin`, `everforest` …), werden übersprungen — das Built-in gewinnt als Source of Truth. Das eingebaute `catppuccin` / `everforest` wird direkt über Hermes benutzt; das Plugin registriert **keinen** `…-omarchy`-Klon.
- **⌘K:** `Apply Omarchy Theme: <Name>`
- **Settings → Plugins → omarchy-themes:** Kartenansicht mit Farbswatches, Filter (Name/Slug/`dark`/`light`) und *Apply*-Button.
- **CLI/TUI:** `omarchy theme set nord` → Hook schreibt Skin → `hermes skin use nord` (live in ~1 s).

### Was das Plugin anpasst

Jedes registrierte Theme liefert **beide** Paletten + **beide** Terminal-Paletten + **Typography**, damit der Wechsel zwischen Light- und Dark-Mode in Hermes die ganze UI neu einfärbt — nicht nur die Border:

| Feld | Wofür |
|---|---|
| `colors` / `darkColors` | Hintergrund, Card, Popover, Sidebar, Input, Border, Primary/Accent, Muted, Destructive, User-Bubble. Beide Paletten teilen denselben Marken-`accent`/`primary`/`ring`/`midground`/`composerRing`; die Gegenpalette wird automatisch synthetisiert, damit jedes Theme echten Hell/Dunkel-Kontrast hat (Rec.709-Luma ≥ 0,5 zwischen `colors.background` und `darkColors.background`). Siehe [Implementation Notes](#-implementation-notes). |
| `terminal` / `darkTerminal` | ANSI-Palette (schwarz/weiß + 8 Farben + Bright-Varianten) fürs integrierte Terminal |
| `typography` | `fontSans` (System-Stack mit Emoji-Fallback), `fontMono` (JetBrains-Mono-Stack) |

### 🔬 Implementation Notes

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

---

## 🔄 Themes aktualisieren

Die Paletten sind ins Plugin eingebacken (der Desktop-Renderer hat keinen Dateisystemzugriff). Nach einem Omarchy-Update:

```bash
make generate          # Paletten neu einlesen und plugin.js überschreiben
make generate-check    # nur prüfen, ob plugin.js aktuell ist (Exit 1 wenn nicht)
```

Eigene Themes aus `~/.config/omarchy/themes/` einschließen:

```bash
python3 scripts/generate-themes.py --include-user
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
shellcheck hooks/hermes-skin-sync.sh tests/hook.sh
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
│   └── generate-themes.py    # colors.toml → Theme-Tabelle in plugin.js
├── tests/
│   ├── smoke.mjs             # Plugin in Node mit SDK-Stubs
│   ├── hook.sh               # Hook gegen Fixture in Sandbox-$HOME
│   └── stubs/                # @hermes/plugin-sdk, react, react/jsx-runtime
├── Makefile
└── README.md
```

Der Desktop-Plugin-Pfad (`desktop/plugin.js`) entspricht dem, was der Hermes-Plugin-Loader beim `hermes plugins install <url>` sucht (siehe `findDesktopEntry` in `desktop-plugin-install.ts`). Früher lag das Plugin unter `plugin/desktop/plugin.js` — der Loader hat dort nichts erkannt und brach mit „No agent or desktop plugin artifacts found" ab.

Zielpfade nach Installation:

| Datei | Ziel |
|---|---|
| `desktop/plugin.js` | `~/.hermes/plugins/omarchy-themes/desktop/plugin.js` |
| `hooks/hermes-skin-sync.sh` | manuell kopieren nach `~/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh` |

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
