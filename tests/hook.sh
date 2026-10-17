#!/bin/sh
# Hook test: run hermes-skin-sync.sh against a fixture theme in a throwaway
# $HOME and validate the generated skin YAML.
#
#   sh tests/hook.sh
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/omarchy-hook.XXXXXX")
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/.config/omarchy/themes/fixture"
cat > "$SANDBOX/.config/omarchy/themes/fixture/colors.toml" <<'EOF'
mode = "dark"
# comment lines are ignored
accent = "#81A1C1"
background = "#2e3440"
dark_background = "#222730"
foreground = "#d8dee9"
muted = "#4c566a"
red = "#bf616a"
yellow = "#ebcb8b"
green = "#a3be8c"
cyan = "#8cf"
EOF

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

# Fake hermes binaries (the hook requires an executable path, not a builtin).
mkdir -p "$SANDBOX/bin"
printf '#!/bin/sh\nexit 0\n' > "$SANDBOX/bin/hermes-ok"
printf '#!/bin/sh\nexit 3\n' > "$SANDBOX/bin/hermes-fail"
chmod +x "$SANDBOX/bin/hermes-ok" "$SANDBOX/bin/hermes-fail"
LOG="$SANDBOX/.hermes/logs/omarchy-theme-sync.log"

# 1. Happy path.
HOME="$SANDBOX" HERMES_BIN="$SANDBOX/bin/hermes-ok" sh "$ROOT/hooks/hermes-skin-sync.sh" fixture
SKIN="$SANDBOX/.hermes/skins/fixture.yaml"
[ -s "$SKIN" ] || fail "skin not written"
grep -q '^name: fixture$' "$SKIN"                 || fail "name"
grep -q '  ui_accent: "#81a1c1"' "$SKIN"           || fail "accent not lower-cased"
grep -q '  response_border: "#88ccff"' "$SKIN"     || fail "3-digit hex not expanded"
grep -q '  status_bar_bg: "#222730"' "$SKIN"       || fail "dark_background mapping"
[ "$(grep -c '^  [a-z_]*: "#[0-9a-f]\{6\}"$' "$SKIN")" -eq 22 ] || fail "expected 22 colour keys"
grep -q 'OK: hermes skin use fixture succeeded' "$LOG" || fail "activation not logged"

# 2. Unknown slug — must log SKIP and still exit 0 (never break the hook chain).
HOME="$SANDBOX" HERMES_BIN="$SANDBOX/bin/hermes-ok" sh "$ROOT/hooks/hermes-skin-sync.sh" does-not-exist \
    || fail "unknown slug must exit 0"
grep -q "SKIP: slug='does-not-exist'" "$LOG" || fail "skip not logged"

# 3. Hermes binary failing — still exit 0.
HOME="$SANDBOX" HERMES_BIN="$SANDBOX/bin/hermes-fail" sh "$ROOT/hooks/hermes-skin-sync.sh" fixture \
    || fail "hermes failure must exit 0"
grep -q 'ERR: hermes skin use fixture exited 3' "$LOG" || fail "failure not logged"

echo "ok — hook: skin generation, skip path, failure path"
