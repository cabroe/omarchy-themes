# omarchy-themes

Hermes-Desktop-Plugin zum Importieren der Omarchy-Theme-Colorschemata als wählbare Skins.

Liest `colors.toml` aus den Omarchy-Theme-Verzeichnissen (`/usr/share/omarchy/themes/` und `~/.config/omarchy/themes/`), konvertiert sie ins `DesktopTheme`-Format und registriert sie über `THEMES_AREA` im Hermes-Desktop-Theme-Picker.

## Architektur

Unified Package mit Python-Backend (FS-Zugriff + REST-API) und Hermes-Desktop-Plugin (JS, plain ESM):

```
omarchy-themes/
├── plugin/
│   ├── plugin.yaml                 # Python-Manifest
│   ├── register.py                 # Python register(ctx)
│   ├── dashboard/
│   │   ├── manifest.json           # {"api": "plugin_api.py"}
│   │   └── plugin_api.py           # FastAPI Router: GET /themes, POST /rescan
│   ├── desktop/
│   │   └── plugin.js               # Hermes-Desktop-Plugin
│   └── tests/
│       ├── fixtures/themes/         # Sample colors.toml-Dateien
│       ├── test_parser.py          # Mapping-Test
│       └── test_server.py          # REST-Endpoint-Test
└── README.md
```

## Lokaler Test

```bash
cd plugin/
python3 tests/test_parser.py    # validiert Mapping colors.toml → DesktopTheme
python3 tests/test_server.py   # mountet Router, ruft /themes, assertiert 2 Themes
```

## Deploy nach omarchy

```bash
# Files kopieren (lokal vnic → omarchy via SSH-Alias)
ssh omarchy "mkdir -p ~/.hermes/plugins/omarchy-themes/dashboard ~/.hermes/plugins/omarchy-themes/desktop"
scp plugin/plugin.yaml            omarchy:~/.hermes/plugins/omarchy-themes/
scp plugin/register.py            omarchy:~/.hermes/plugins/omarchy-themes/
scp plugin/dashboard/manifest.json omarchy:~/.hermes/plugins/omarchy-themes/dashboard/
scp plugin/dashboard/plugin_api.py omarchy:~/.hermes/plugins/omarchy-themes/dashboard/
scp plugin/desktop/plugin.js      omarchy:~/.hermes/plugins/omarchy-themes/desktop/

# Plugin in config.yaml aktivieren
ssh omarchy "cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak-\$(date +%s)"
# omarchy-themes zur plugins.enabled Liste ergänzen, dann:
ssh omarchy "hermes gateway restart"

# Verifizieren: REST-Endpoint sollte JSON-Array mit Themes liefern
curl http://<omarchy>:<PORT>/api/plugins/omarchy-themes/themes
```

Im Hermes-Desktop: ⌘K → "Reload desktop plugins" → Theme-Picker sollte die neuen Themes zeigen.

## Mapping-Übersicht

| Omarchy `colors.toml` | Hermes `DesktopTheme` |
|---|---|
| `mode` | `colors` (light) + `darkColors` (dark) je nach Wert |
| `background` | `colors.background`, `terminal.black` |
| `foreground` | `colors.foreground`, `terminal.white` |
| `lighter_background` | `colors.card`, `colors.popover` |
| `accent` | `colors.accent`, `colors.primary`, `colors.ring`, `colors.midground`, `colors.composerRing` |
| `muted` | `colors.muted` |
| `dark_foreground` | `colors.mutedForeground` |
| `dark_background` | `colors.border`, `colors.input`, `colors.sidebarBackground`, `colors.userBubbleBorder` |
| `selection` | `colors.destructive`, `terminal.selectionBackground` |
| `red`/`green`/`yellow`/`blue`/`magenta`/`cyan` | `terminal.{red,green,yellow,blue,magenta,cyan}` |
| `bright_*` | `terminal.bright*` |
| `orange` | `terminal.yellow` (Fallback, da xterm kein orange hat) |
| `brown` | `terminal.black` mit Offset |

## Status

In Entwicklung — Implementierung durch coder-Bot, Review durch reviewer-Bot, Deploy durch ops-Bot (siehe Kanban-Board).