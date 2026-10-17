# omarchy-themes

Bringt die [Omarchy](https://omarchy.org)-Farbschemata in **Hermes**: als Themes im Hermes-Desktop und als Live-Skin für Hermes CLI/TUI.

| Komponente | Was sie tut |
|---|---|
| **Desktop-Plugin** (`plugin/desktop/plugin.js`) | Registriert alle 22 Omarchy-Stock-Themes im Theme-Picker, als ⌘K-Befehle und auf einer eigenen Settings-Seite (Suche, Farbvorschau, *Apply*). Läuft rein lokal, ohne Backend und ohne Netzwerk. |
| **Theme-Sync-Hook** (`hooks/hermes-skin-sync.sh`) | Läuft bei `omarchy theme set <slug>`, erzeugt `~/.hermes/skins/<slug>.yaml` und aktiviert den Skin. CLI und TUI folgen dem Omarchy-Theme damit automatisch. |
| **Generator** (`scripts/generate-themes.py`) | Liest die `colors.toml`-Dateien und schreibt die Theme-Tabelle im Plugin neu, z. B. nach Omarchy-Updates oder für eigene Themes. |

## Schnellstart

```bash
make check     # Lint + Tests, lokal, kein Host nötig
make deploy    # check, dann Plugin + Hook nach omarchy kopieren und Byte für Byte verifizieren
```

Danach im Hermes-Desktop **⌘K → „Reload desktop plugins“** ausführen und das Plugin unter *Capabilities → Plugins* aktivieren. Es ist opt-in (`defaultEnabled: false`).

Für einen anderen Host als den SSH-Alias `omarchy`: `make deploy HOST=<alias>`. Nur das Plugin ohne Hook: `scripts/deploy.sh --plugin-only`.

## Benutzung

- **Theme-Picker:** Die Omarchy-Themes stehen neben den eingebauten Hermes-Themes. Namen, die mit einem Hermes-Built-in kollidieren (`catppuccin`, `everforest`), bekommen das Suffix `-omarchy`.
- **⌘K:** `Apply Omarchy Theme: <Name>`
- **Settings → Plugins → Omarchy Themes:** Kartenansicht mit Farbswatches, Filter (Name, Slug oder `dark`/`light`), *Apply* und *Copy name*.
- **CLI/TUI:** Bei `omarchy theme set nord` schreibt der Hook den Skin und ruft `hermes skin use nord`.

## Themes aktualisieren

Die Paletten sind ins Plugin eingebacken, weil der Desktop-Renderer in einer Sandbox ohne Dateisystemzugriff läuft. Nach einem Omarchy-Update:

```bash
make generate        # = scripts/generate-themes.py --remote omarchy
make generate-check  # nur prüfen, ob plugin.js aktuell ist (Exit 1, wenn nicht)
make deploy
```

Eigene Themes aus `~/.config/omarchy/themes/` lassen sich zusätzlich aufnehmen. Sie überschreiben System-Themes mit gleichem Slug, und Themes ohne `background`/`foreground`/`accent` werden übersprungen:

```bash
scripts/generate-themes.py --remote omarchy --include-user
```

Direkt auf dem omarchy-Host läuft der Generator ohne `--remote`. Er ersetzt nur den Block zwischen `// BEGIN GENERATED THEMES` und `// END GENERATED THEMES` und arbeitet deterministisch (sortiert nach Slug). Ein Lauf ohne geänderte Quellen erzeugt also keinen Diff.

## Verifizieren auf dem Host

```bash
# Hook direkt für ein paar Themes ausführen
ssh omarchy 'for s in catppuccin tokyo-night nord; do
  sh ~/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh "$s"
  ~/.local/bin/hermes skin list | grep "*"
done'

# End-to-End über Omarchy (Login-Shell, damit OMARCHY_PATH gesetzt ist)
ssh omarchy 'bash -lc "omarchy theme set nord"'
ssh omarchy '~/.local/bin/hermes skin list | grep "*"'   # → * nord

# Hook-Log
ssh omarchy 'tail ~/.hermes/logs/omarchy-theme-sync.log'
```

## Projektstruktur

```
omarchy-themes/
├── plugin/desktop/plugin.js     # Hermes-Desktop-Plugin (plain ESM, kein Build)
├── hooks/hermes-skin-sync.sh    # Omarchy-theme-set-Hook → Hermes-CLI/TUI-Skin
├── scripts/
│   ├── generate-themes.py       # colors.toml → Theme-Tabelle in plugin.js
│   └── deploy.sh                # scp + Byte-Vergleich auf dem Zielhost
├── tests/
│   ├── smoke.mjs                # lädt plugin.js mit SDK-Stubs, prüft register()
│   ├── hook.sh                  # Hook gegen Fixture in Sandbox-$HOME
│   └── stubs/                   # @hermes/plugin-sdk, react, react/jsx-runtime
└── Makefile
```

Zielpfade auf dem Host:

| Datei | Ziel |
|---|---|
| `plugin/desktop/plugin.js` | `~/.hermes/desktop-plugins/omarchy-themes/plugin.js` |
| `hooks/hermes-skin-sync.sh` | `~/.config/omarchy/hooks/theme-set.d/hermes-skin-sync.sh` |

## Tests

| Test | Prüft |
|---|---|
| `node --check`, `py_compile`, `shellcheck` | Syntax und Lint aller Dateien |
| `tests/smoke.mjs` | Plugin lädt in Node und registriert Themes, ⌘K-Befehle und Settings-Seite. Alle Farben sind gültiges `#rrggbb`, kein Name ist doppelt. |
| `tests/hook.sh` | Skin-YAML (22 Keys, Kleinschreibung, Expansion von 3- auf 6-stellige Hex-Werte), Skip bei unbekanntem Slug, Exit 0 auch dann, wenn `hermes` fehlschlägt |

Voraussetzungen: Node ≥ 22, Python ≥ 3.11 und `shellcheck`. Für `generate` und `deploy` braucht es zusätzlich SSH-Zugriff auf den Host.

## Farb-Mapping

### Desktop-Theme (`DesktopTheme`)

| Omarchy `colors.toml` | Hermes |
|---|---|
| `background` | `colors.background`, `terminal.black`, `terminal.brightBlack` |
| `foreground` | `colors.foreground` + alle `*Foreground`, `terminal.foreground`, `terminal.cursor`, `terminal.brightWhite` |
| `accent` | `colors.primary`, `accent`, `ring`, `midground`, `composerRing`; die Textfarbe darauf wird je nach Luminanz automatisch weiß oder schwarz |
| `lighter_background` | `colors.card`, `popover`, `secondary`, `userBubble` |
| `dark_background` | `colors.border`, `input`, `sidebarBackground`, `sidebarBorder`, `userBubbleBorder` |
| `muted` / `dark_foreground` | `colors.muted` / `colors.mutedForeground` |
| `red` | `colors.destructive` |
| `selection` | `terminal.selectionBackground` |
| `bright_foreground` | `terminal.white` |
| `red` … `magenta`, `bright_*` | `terminal.*` / `terminal.bright*` |
| `mode = "light"` | zusätzlich `darkColors`/`darkTerminal` aus `dark_background`/`darker_background` |

Fehlende Keys fallen auf `background`/`foreground`/`accent` zurück. Fehlt einer dieser drei, wird das Theme übersprungen.

### CLI/TUI-Skin (Hook)

Der Hook schreibt 22 Keys. Alles Weitere erbt der Skin-Loader vom `default`-Skin.

| Omarchy `colors.toml` | Hermes-Skin `colors.*` |
|---|---|
| `background` | `background` |
| `foreground` | `banner_title`, `banner_text`, `ui_text`, `prompt`, `status_bar_text` |
| `accent` | `ui_accent`, `banner_accent`, `input_rule` |
| `dark_background` | `banner_border`, `ui_border`, `status_bar_bg`, `session_border` |
| `muted` | `banner_dim` |
| `green` / `yellow` / `red` | `ui_ok` / `ui_warn` / `ui_error` und `status_bar_good` / `_warn` / `_critical` |
| `cyan` | `response_border`, `session_label` |

Der Hook ist reines POSIX-`sh` ohne Python. Ein User-Theme hat Vorrang vor dem gleichnamigen System-Theme. Er beendet sich immer mit Exit 0, damit Omarchys Hook-Kette nie abbricht.

## Privatheit

Das Repo ist **privat** und bleibt es, bis eine Veröffentlichung ausdrücklich freigegeben wird. Das gilt auch für jeden Mirror.
