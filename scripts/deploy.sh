#!/bin/sh
# shellcheck disable=SC2029  # remote paths are intentionally expanded client-side
# deploy.sh — copy the desktop plugin and the theme-sync hook to an Omarchy host.
#
#   scripts/deploy.sh [host]          # default host: omarchy (SSH alias)
#   scripts/deploy.sh --plugin-only   # skip the hook
#
# Idempotent. After deploying, reload in Hermes Desktop:
#   ⌘K → "Reload desktop plugins"
set -eu

cd "$(dirname "$0")/.."

HOST=omarchy
WITH_HOOK=1
for arg in "$@"; do
    case "$arg" in
        --plugin-only) WITH_HOOK=0 ;;
        -h|--help) sed -n '3,9p' "$0"; exit 0 ;;
        -*) printf 'unknown option: %s\n' "$arg" >&2; exit 64 ;;
        *) HOST=$arg ;;
    esac
done

PLUGIN_DIR='.hermes/plugins/omarchy-themes/desktop'
HOOK_DIR='.config/omarchy/hooks/theme-set.d'

echo "→ plugin.js  → $HOST:~/$PLUGIN_DIR/plugin.js"
ssh "$HOST" "mkdir -p ~/$PLUGIN_DIR"
scp -q desktop/plugin.js "$HOST:$PLUGIN_DIR/plugin.js"

if [ "$WITH_HOOK" = 1 ]; then
    echo "→ hook       → $HOST:~/$HOOK_DIR/"
    ssh "$HOST" "mkdir -p ~/$HOOK_DIR"
    scp -q hooks/hermes-skin-sync.sh "$HOST:$HOOK_DIR/hermes-skin-sync.sh"
    ssh "$HOST" "chmod +x ~/$HOOK_DIR/hermes-skin-sync.sh"
fi

# Verify: remote files must match the repo byte for byte.
verify() {
    if ssh "$HOST" "cat ~/$2" | cmp -s - "$1"; then
        echo "✓ $1 verified"
    else
        echo "✗ $1 differs on $HOST" >&2
        exit 1
    fi
}
verify desktop/plugin.js "$PLUGIN_DIR/plugin.js"
[ "$WITH_HOOK" = 1 ] && verify hooks/hermes-skin-sync.sh "$HOOK_DIR/hermes-skin-sync.sh"

echo 'Done. Hermes Desktop: ⌘K → "Reload desktop plugins"'
