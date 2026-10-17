# omarchy-themes

Hermes-Desktop plugin that imports Omarchy theme directories
(`/usr/share/omarchy/themes`, `~/.config/omarchy/themes`) as selectable
skins in Hermes-Desktop. Ships as a unified package — Python backend +
desktop UI in one folder.

## What it does

1. The Python backend (`dashboard/plugin_api.py`) walks the configured
   Omarchy theme directories, parses each `colors.toml`, and maps the
   Omarchy color keys to a `DesktopTheme` the desktop app understands.
2. The desktop plugin (`desktop/plugin.js`) fetches that list via
   `ctx.rest('/themes')`, registers each theme as a `THEMES_AREA`
   contribution (so it shows up in the picker), and adds a Settings page
   with a Browse/About split for browsing and re-scanning.
3. Cmd-K palette registers "Apply Omarchy Theme: <name>" rows (capped at
   30) so the user can switch without opening Settings.

The plugin inventories with `defaultEnabled: false` — opt-in via
Settings → Capabilities → Plugins after install, so it doesn't dump a
hundred themes into the picker on first install.

## Repository layout

```
plugin/
├── plugin.yaml                      # Python manifest
├── register.py                      # Agent-side register() (no-op)
├── dashboard/
│   ├── manifest.json                # {"api": "plugin_api.py"}
│   └── plugin_api.py                # FastAPI router, /themes + /rescan
├── desktop/
│   └── plugin.js                    # Hermes-Desktop plugin (THEMES_AREA)
└── tests/
    ├── fixtures/themes/             # catppuccin + gruvbox + empty
    ├── test_parser.py               # Mapping unit tests
    └── test_server.py               # FastAPI route tests
```

## Mapping highlights

`colors.toml` keys are mapped to `DesktopTheme.colors`:

| Omarchy key          | DesktopTheme slot(s)                       |
| -------------------- | ------------------------------------------ |
| `background`         | `colors.background`                        |
| `foreground`         | `colors.foreground`, `cardForeground`      |
| `lighter_background` | `colors.card`, `popover`                   |
| `dark_background`    | `colors.border`, `input`, `sidebarBackground`, `sidebarBorder`, `userBubbleBorder` |
| `dark_foreground`    | `colors.mutedForeground`                   |
| `muted`              | `colors.muted`                            |
| `accent`             | `colors.primary`, `accent`, `ring`, `midground`, `composerRing` |
| `selection`          | `terminal.selectionBackground`             |
| `red/yellow/green/blue/magenta/cyan` + bright_* | `colors.destructive`, `terminal.ansi*` |

Mode-aware: when the omarchy theme declares `mode = "light"`, the
backend emits `darkColors` + `darkTerminal` derived from the same
palette (the dark variant of a light theme).

Theme names that collide with Hermes-Desktop built-ins (`github`, `nous`,
`catppuccin`, `everforest`, `solarized`, `nous-alt`, `classic`,
`midnight`, `ember`, `mono`, `cyberpunk`, `slate`) are suffixed with
`-omarchy` so `user-themes.ts` doesn't silently drop the contribution.

## Local development

```bash
cd plugin/

# Parser unit tests (no FastAPI required)
python3 tests/test_parser.py

# Server tests (boots the router via fastapi.testclient)
python3 tests/test_server.py

# Syntax-check everything
python3 -m py_compile plugin.yaml dashboard/manifest.json dashboard/plugin_api.py register.py
node -c desktop/plugin.js
```

Both tests exit 0 on success and rely only on the stdlib `tomllib` plus
FastAPI. Fixtures live in `tests/fixtures/themes/` so the tests are
hermetic — no Omarchy installation required.

> **Note:** System-Python (`/usr/bin/python3`) on the build host may not
> ship FastAPI. If `test_server.py` errors with `ModuleNotFoundError:
> No module named 'fastapi'`, use the Hermes-managed Python instead:
> `/home/opc/.hermes/installs/5ab599b943b5eb79/environments/92a85146f7a54a1db2221dfb01a2f734/venv/bin/python3`
> (or source the matching `venv/bin/activate`).

## Configuration

Override the scanned paths via the `OMARCHY_THEME_PATHS` environment
variable (comma-separated). A path beginning with `~` is expanded
against the user's home; non-existent paths are skipped with an info
log, not fatal.

```bash
export OMARCHY_THEME_PATHS="/usr/share/omarchy/themes,/srv/team-themes,~/.config/omarchy/themes"
```

Default paths: `/usr/share/omarchy/themes`, `~/.config/omarchy/themes`.

## Deploy to omarchy (Tailscale)

The deploy is a separate ops task. The target shape on omarchy is:

```
~/.hermes/plugins/omarchy-themes/
├── plugin.yaml
├── register.py
├── dashboard/
│   ├── manifest.json
│   └── plugin_api.py
└── desktop/
    └── plugin.js
```

From a developer's box:

```bash
OMARCHY=cabroe@100.81.118.6   # Tailscale IP, SSH user
SRC=~/projects/omarchy-themes/plugin

ssh "$OMARCHY" "mkdir -p ~/.hermes/plugins/omarchy-themes"
scp -r "$SRC/plugin.yaml" "$SRC/register.py" \
      "$OMARCHY:~/.hermes/plugins/omarchy-themes/"
scp -r "$SRC/dashboard" "$SRC/desktop" \
      "$OMARCHY:~/.hermes/plugins/omarchy-themes/"
```

Then on omarchy:

1. Edit `~/.hermes/config.yaml` and append `omarchy-themes` to
   `plugins.enabled`.
2. Restart the Hermes gateway so it picks up the new plugin:

   ```bash
   systemctl --user restart hermes-gateway   # or however the host runs it
   ```

3. In Hermes-Desktop: ⌘K → "Reload desktop plugins" — the new theme
   contributions and the Settings ▸ Plugins ▸ Omarchy Themes page
   appear.

## Limitations

- The desktop plugin only renders a thin preview swatch; the actual
  visual preview has to come from applying the theme. The Browse page
  ships an "Apply" button that calls `requestTheme(name)` directly.
- Custom Omarchy themes that ship their own `colors.toml` under
  `~/.config/omarchy/themes/` are scanned alongside stock themes. Themes
  cloned by `omarchy theme install <url>` should work the same way.
- Non-hex values in `colors.toml` are dropped with a debug log — a
  theme whose three required colors (`background`, `foreground`,
  `accent`) fail to normalize is skipped entirely.
- The cache TTL is 5 minutes. Use the "Rescan" button on the Settings
  page or `POST /rescan` after adding a new theme.
- The plugin doesn't ship a font picker or typography override; the
  desktop theme inherits the app's font settings.