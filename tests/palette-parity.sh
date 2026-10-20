#!/bin/sh
# Palette parity — the colors.toml → palette mapping must resolve identically
# across the three independent implementations that all feed the same UI:
#   * hooks/hermes-skin-sync.sh   (shell, grep+sed, POSIX)
#   * scripts/generate-themes.py  (Python, tomllib) — parse_palette
#   * desktop/plugin.js           paletteFromToml (live path for unknown themes)
# Drift between them is a bug, not a style choice. Each fixture is resolved
# through all three and the canonical keys are compared as one line.
#
#   sh tests/palette-parity.sh
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/omarchy-parity.XXXXXX")
trap 'rm -rf "$SANDBOX"' EXIT

# Fake hermes binary — the hook requires an executable path, not a builtin.
mkdir -p "$SANDBOX/bin"
printf '#!/bin/sh\nexit 0\n' > "$SANDBOX/bin/hermes"
chmod +x "$SANDBOX/bin/hermes"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

# Extract one `key: "value"` line from a generated skin YAML.
skin_val() { sed -n "s/^  $1: \"\\([^\"]*\\)\".*/\\1/p" "$2"; }

# Resolve a fixture through the hook: install it as an Omarchy user theme,
# run the hook with a throwaway HOME, then read the skin YAML back as the
# canonical 8-key line. Canonical order mirrors palette-parity.mjs.
hook_resolve() {
    slug=$1
    toml=$2
    mkdir -p "$SANDBOX/.config/omarchy/themes/$slug"
    cp "$toml" "$SANDBOX/.config/omarchy/themes/$slug/colors.toml"
    rm -f "$SANDBOX/.hermes/skins/$slug.yaml"
    HOME="$SANDBOX" HERMES_BIN="$SANDBOX/bin/hermes" sh "$ROOT/hooks/hermes-skin-sync.sh" "$slug" >/dev/null 2>&1
    skin="$SANDBOX/.hermes/skins/$slug.yaml"
    [ -s "$skin" ] || fail "hook: no skin written for $slug"
    mode=$(sed -n 's/^description: Omarchy theme .* (\(light\|dark\))$/\1/p' "$skin")
    printf '%s' \
        "background=$(skin_val background "$skin") " \
        "foreground=$(skin_val banner_title "$skin") " \
        "accent=$(skin_val ui_accent "$skin") " \
        "red=$(skin_val ui_error "$skin") " \
        "green=$(skin_val ui_ok "$skin") " \
        "yellow=$(skin_val ui_warn "$skin") " \
        "cyan=$(skin_val response_border "$skin") " \
        "mode=$mode"
}

# Resolve a fixture through the generator's parse_palette (Python). Prints the
# same canonical line as the hook and the plugin harness.
gen_resolve() {
    toml=$1
    python3 - "$ROOT" "$toml" <<'PY'
import importlib.util, sys
root, path = sys.argv[1], sys.argv[2]
spec = importlib.util.spec_from_file_location("gt", root + "/scripts/generate-themes.py")
gt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gt)
p = gt.parse_palette("parity", open(path, encoding="utf-8").read())
if p is None:
    print("parse_palette returned None", file=sys.stderr)
    sys.exit(2)
print("background={} foreground={} accent={} red={} green={} yellow={} cyan={} mode={}".format(
    p["background"], p["foreground"], p["accent"],
    p["red"], p["green"], p["yellow"], p["cyan"], p["mode"]))
PY
}

# Resolve a fixture through the plugin harness (Node).
plugin_resolve() {
    node --enable-source-maps "$ROOT/tests/palette-parity.mjs" "$1"
}

# Compare the three resolutions of one fixture. They must be byte-identical.
check_fixture() {
    slug=$1
    toml=$2
    hook=$(hook_resolve "$slug" "$toml")
    gen=$(gen_resolve "$toml")
    plugin=$(plugin_resolve "$toml")
    if [ "$hook" != "$gen" ] || [ "$gen" != "$plugin" ]; then
        printf 'FAIL: %s resolvers disagree:\n' "$slug" >&2
        printf '  hook:   %s\n' "$hook" >&2
        printf '  gen:    %s\n' "$gen" >&2
        printf '  plugin: %s\n' "$plugin" >&2
        exit 1
    fi
    printf 'ok — %s resolves identically across hook/generator/plugin\n' "$slug"
}

# Fixture 1: canonical named keys + explicit mode. No fallback ambiguity.
NAMED="$SANDBOX/named.toml"
cat > "$NAMED" <<'EOF'
mode = "dark"
accent = "#81A1C1"
background = "#2e3440"
foreground = "#d8dee9"
muted = "#4c566a"
red = "#bf616a"
green = "#a3be8c"
yellow = "#ebcb8b"
cyan = "#88c0d0"
blue = "#5e81ac"
magenta = "#b48ead"
EOF

# Fixture 2: color0..15 aliases only + 3-digit hex, no mode key. The
# background is unambiguously dark so the mode fallback agrees everywhere
# (hook raw R+G+B > 382 vs generator/plugin Rec.709 luma > 0.5 both → dark).
# Full ANSI set (color1..6) so the generator's stricter REQUIRED_ANSI filter
# accepts it too — the hook and plugin only require background/foreground/accent.
ALIAS="$SANDBOX/alias.toml"
cat > "$ALIAS" <<'EOF'
accent = "#69f"
background = "#000000"
foreground = "#e6e6e6"
color1 = "#e65c5c"
color2 = "#66cc66"
color3 = "#ffcc66"
color4 = "#5e81ac"
color5 = "#b48ead"
color6 = "#66cccc"
color8 = "#404040"
EOF

check_fixture parity-named "$NAMED"
check_fixture parity-alias "$ALIAS"

echo "ok — palette parity: named keys and colorN aliases resolve identically"
