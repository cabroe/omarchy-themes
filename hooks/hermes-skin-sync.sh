#!/bin/sh
# hermes-skin-sync.sh — Omarchy theme → Hermes Desktop skin bridge.
#
# Called by Omarchy's theme-set hook system. Each script in
# ~/.config/omarchy/hooks/theme-set.d/ receives the new theme slug as $1.
# We translate the Omarchy colors.toml into a Hermes skin YAML and switch
# the active skin.
#
# Robustness: POSIX /bin/sh, no Python, grep+sed only. Missing files or
# partial palettes must produce a graceful log entry and exit 0. Omarchy's
# `omarchy-hook` runs each script with `|| echo "Hook failed: …"` and
# continues with the sibling hooks — we still exit 0 to keep the log line
# clean.

set -u

# Defensive default for $HOME: Omarchy passes an unset/empty HOME on some
# bootstrapping paths (e.g. systemd --user before userdb is up), and `set -u`
# would otherwise abort the hook before we ever reach a log line. /tmp is
# always writable and the resulting log file is still discoverable.
: "${HOME:=/tmp}"

SLUG="${1:-}"
if [ -z "$SLUG" ]; then
    printf 'usage: %s <theme-slug>\n' "$0" >&2
    exit 0
fi

# Honour Omarchy's "skip automatic Hermes skin changes" toggle. Must be
# checked before any side effects (mkdir, log writes) so the toggle truly
# silences this hook without leaving half-written state behind.
if [ -e "$HOME/.local/state/omarchy/toggles/skip-hermes-theme-changes" ]; then
    exit 0
fi

HERMES_BIN="${HERMES_BIN:-$HOME/.local/bin/hermes}"
SKIN_DIR="$HOME/.hermes/skins"
LOG_DIR="$HOME/.hermes/logs"
LOG_FILE="$LOG_DIR/omarchy-theme-sync.log"

mkdir -p "$LOG_DIR"

log() {
    ts=$(date '+%Y-%m-%dT%H:%M:%S%z' 2>/dev/null || date)
    printf '[%s] %s\n' "$ts" "$*" >> "$LOG_FILE"
}

# --- Source resolution ---------------------------------------------------
# User overlay (highest priority), then system themes shipped with Omarchy,
# then the theme Omarchy just applied. The last one covers themes that ship no
# colors.toml of their own (e.g. only an alacritty.toml): omarchy-theme-set
# generates the colors.toml into its current-theme dir before the hooks run.
# It is only trusted while theme.name says it belongs to this slug.
USER_THEME="$HOME/.config/omarchy/themes/${SLUG}/colors.toml"
SYSTEM_THEME="/usr/share/omarchy/themes/${SLUG}/colors.toml"
OMARCHY_STATE="$HOME/.local/state/omarchy/current"
CURRENT_THEME="$OMARCHY_STATE/theme/colors.toml"

COLORS=""
# `current/theme/colors.toml` is what `omarchy-theme-set` just wrote — the
# authoritative resolved palette. Prefer it whenever theme.name matches the
# slug we were invoked with, falling back to the user's overlay and the
# shipped system theme otherwise.
if [ -s "$CURRENT_THEME" ] && [ "$(cat "$OMARCHY_STATE/theme.name" 2>/dev/null)" = "$SLUG" ]; then
    COLORS="$CURRENT_THEME"
    SOURCE_DESC="current"
elif [ -s "$USER_THEME" ]; then
    COLORS="$USER_THEME"
    SOURCE_DESC="user"
elif [ -s "$SYSTEM_THEME" ]; then
    COLORS="$SYSTEM_THEME"
    SOURCE_DESC="system"
fi

if [ -z "$COLORS" ]; then
    log "SKIP: slug='${SLUG}' — no colors.toml (looked in ${USER_THEME}, ${SYSTEM_THEME} and ${CURRENT_THEME})"
    exit 0
fi

# --- TOML extraction helpers --------------------------------------------
# Lines we care about look like `key = "#aabbcc"`. Grep+sed handles that
# shape without a TOML parser; values are 3- or 6-digit hex strings inside
# quotes (the format Omarchy ships).

# Extract a hex value for $1 (e.g. "background") and print it. Empty on miss.
# - Grep matches a key-name boundary ([^A-Za-z0-9_] before the key) so `red`
#   doesn't match `redder` — ERE has no look-around, a character class does it.
# - Sed anchors on the first `=` (via `[^=]*=` instead of greedy `.*=`) so a
#   trailing comment like `# was = "#000000"` is consumed by `.*` instead of
#   being parsed as the value. A greedy `.*=` would otherwise pull the last
#   quoted token in the line — the bug extracted `#000000` for `red`.
toml_hex() {
    key=$1
    grep -E "(^|[^A-Za-z0-9_])${key}([[:space:]]+|[[:space:]]*=|[[:space:]]*$)" "$COLORS" 2>/dev/null \
        | grep -v "^[[:space:]]*#" \
        | head -n 1 \
        | sed -E 's/^[^=]*=[[:space:]]*"([^"]+)".*/\1/; t; s/^[^=]*=[[:space:]]*([#0-9a-fA-F]+).*/\1/'
}

# Extract a quoted string for $1 (used for `mode`). Empty on miss.
# Tries quoted form first, then unquoted (matching plugin.js paletteFromToml).
toml_string() {
    key=$1
    grep -E "^[[:space:]]*${key}[[:space:]]*=" "$COLORS" 2>/dev/null \
        | grep -v "^[[:space:]]*#" \
        | head -n 1 \
        | sed -E 's/.*=[[:space:]]*"([^"]+)".*/\1/; t; s/.*=[[:space:]]*([A-Za-z0-9_-]+).*/\1/'
}

# Normalize a hex value to #rrggbb lowercase. Empty on invalid input.
norm_hex() {
    raw=$1
    [ -z "$raw" ] && return 0
    case "$raw" in
        \#*) h=${raw#\#} ;;
        *)   h=$raw ;;
    esac
    h=$(printf '%s' "$h" | tr '[:upper:]' '[:lower:]')
    case "$h" in
        [0-9a-f][0-9a-f][0-9a-f])           # 3-digit → expand
            printf '#%s%s%s%s%s%s\n' \
                "$(printf '%s' "$h" | cut -c1)" \
                "$(printf '%s' "$h" | cut -c1)" \
                "$(printf '%s' "$h" | cut -c2)" \
                "$(printf '%s' "$h" | cut -c2)" \
                "$(printf '%s' "$h" | cut -c3)" \
                "$(printf '%s' "$h" | cut -c3)"
            ;;
        [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f])
            printf '#%s\n' "$h" ;;
        *) return 1 ;;
    esac
}

# Read a key with a fallback chain. Sets $val_norm on success; returns 0 if any
# key produced a valid value, 1 otherwise.
read_key() {
    val_norm=""
    for key in "$@"; do
        raw=$(toml_hex "$key")
        if [ -n "$raw" ]; then
            candidate=$(norm_hex "$raw") || continue
            if [ -n "$candidate" ]; then
                val_norm=$candidate
                return 0
            fi
        fi
    done
    return 1
}

# --- Color extraction with sensible fallbacks ----------------------------
# Pull the core palette. Fallback chains for missing keys so partial
# palettes still yield a usable skin (cf. buildTheme() in desktop/plugin.js).

background=""
foreground=""
accent=""
dark_bg=""
muted=""
red=""
yellow=""
green=""
cyan=""
mode=""

read_key background darker_background dark_background && background=$val_norm
read_key foreground bright_foreground light_foreground && foreground=$val_norm
read_key accent blue magenta && accent=$val_norm
read_key dark_background darker_background background && dark_bg=$val_norm
read_key muted dark_foreground color8 dark_background && muted=$val_norm
read_key red color1 orange bright_red && red=$val_norm
read_key yellow color3 bright_yellow && yellow=$val_norm
read_key green color2 bright_green && green=$val_norm
read_key cyan color6 bright_cyan && cyan=$val_norm

mode=$(toml_string mode)
case "$mode" in
    dark|light) ;;
    *)
        # No usable `mode` (e.g. a colors.toml generated from alacritty.toml):
        # mirror Omarchy's `resolve_theme_mode` — raw R+G+B > 382 = light,
        # else dark. The result only feeds the `description:` line in the
        # skin YAML; the desktop plugin makes its own luma call.
        mode="dark"
        if [ -n "$background" ]; then
            bg_hex=${background#\#}
            r=$((0x$(printf '%s' "$bg_hex" | cut -c1-2)))
            g=$((0x$(printf '%s' "$bg_hex" | cut -c3-4)))
            b=$((0x$(printf '%s' "$bg_hex" | cut -c5-6)))
            [ $((r + g + b)) -gt 382 ] && mode="light"
        fi
        ;;
esac

# Validate required keys — Hermes skin needs at least background/foreground/accent
# to be visible; missing any of them is a hard skip.
if [ -z "$background" ] || [ -z "$foreground" ] || [ -z "$accent" ]; then
    log "SKIP: slug='${SLUG}' — missing required background/foreground/accent in $COLORS"
    exit 0
fi

# Fallbacks for the semantically-less-critical roles. If the theme omits
# a status color, copy the accent so nothing renders invisible.
: "${dark_bg:=$background}"
: "${muted:=$dark_bg}"
: "${red:=$accent}"
: "${yellow:=$accent}"
: "${green:=$accent}"
: "${cyan:=$accent}"

# --- Skin YAML emission --------------------------------------------------
# Layout mirrors the synthesise template at
# ~/.hermes/skills/autonomous-ai-agents/hermes-agent/templates/skin.yaml.
# Only the keys we set are written — the loader merges over the default
# skin's palette, so missing keys inherit the gold classic.
SKIN_FILE="$SKIN_DIR/${SLUG}.yaml"
mkdir -p "$SKIN_DIR"

q() { printf '"%s"' "$1"; }

# Serialise skin write + activation so racing theme sets don't interleave a
# half-written file with `hermes skin use`. The lock file lives in $SKIN_DIR
# so it stays alongside the skin files (which are the contended resource).
LOCK_FILE="$SKIN_DIR/.lock"
SKIN_TMP=""

write_skin() {
    SKIN_TMP=$(mktemp "$SKIN_DIR/.${SLUG}.XXXXXX.tmp") || return 1
    {
        printf 'name: %s\n' "$SLUG"
        printf 'description: Omarchy theme · %s (%s)\n' "$SLUG" "$mode"
        printf 'colors:\n'
        printf '  background: %s\n' "$(q "$background")"
        printf '  ui_accent: %s\n' "$(q "$accent")"
        printf '  banner_accent: %s\n' "$(q "$accent")"
        printf '  banner_title: %s\n' "$(q "$foreground")"
        printf '  banner_text: %s\n' "$(q "$foreground")"
        printf '  ui_text: %s\n' "$(q "$foreground")"
        printf '  banner_dim: %s\n' "$(q "$muted")"
        printf '  banner_border: %s\n' "$(q "$dark_bg")"
        printf '  ui_border: %s\n' "$(q "$dark_bg")"
        printf '  ui_ok: %s\n' "$(q "$green")"
        printf '  ui_warn: %s\n' "$(q "$yellow")"
        printf '  ui_error: %s\n' "$(q "$red")"
        printf '  prompt: %s\n' "$(q "$foreground")"
        printf '  input_rule: %s\n' "$(q "$accent")"
        printf '  response_border: %s\n' "$(q "$cyan")"
        printf '  status_bar_bg: %s\n' "$(q "$dark_bg")"
        printf '  status_bar_text: %s\n' "$(q "$foreground")"
        printf '  status_bar_good: %s\n' "$(q "$green")"
        printf '  status_bar_warn: %s\n' "$(q "$yellow")"
        printf '  status_bar_critical: %s\n' "$(q "$red")"
        printf '  session_label: %s\n' "$(q "$cyan")"
        printf '  session_border: %s\n' "$(q "$dark_bg")"
    } > "$SKIN_TMP" || { rm -f "$SKIN_TMP"; return 1; }
    # Atomic replace: mv -T is the same primitive Omarchy's
    # omarchy-theme-set-hermes uses to swap palettes without races.
    mv -T "$SKIN_TMP" "$SKIN_FILE" || { rm -f "$SKIN_TMP"; return 1; }
}

# `flock -n` skips silently if another hook already holds the lock — Omarchy
# treats a slow hook as fatal and we must never block the chain. The lock
# covers both the skin write AND `hermes skin use` so two quick theme-set
# hooks can't interleave a half-written file with a config activation that
# points at the old palette.
if command -v flock >/dev/null 2>&1; then
    (
        flock -n 9 || { log "SKIP: slug='${SLUG}' — another skin sync in progress"; exit 0; }
        if ! write_skin; then
            log "ERR: slug='${SLUG}' — failed to write skin"
            exit 0
        fi
        log "OK: slug='${SLUG}' skin written → $SKIN_FILE (mode=$mode, source=$SOURCE_DESC, colors=$COLORS)"

        if [ ! -x "$HERMES_BIN" ]; then
            log "WARN: hermes binary not found at $HERMES_BIN — skin file written but not activated"
            exit 0
        fi
        # Capture the exit code BEFORE the if — POSIX `fi` resets `$?` to the
        # last command in the chosen branch, masking the original status.
        "$HERMES_BIN" skin use "$SLUG" >> "$LOG_FILE" 2>&1
        rc=$?
        if [ "$rc" -eq 0 ]; then
            log "OK: hermes skin use $SLUG succeeded"
        else
            log "ERR: hermes skin use $SLUG exited $rc"
        fi
        exit 0  # Never break the hook chain on Hermes-side failure.
    ) 9>"$LOCK_FILE"
else
    # No flock available — fall back to a plain write, but still trap the
    # temp file so a crash mid-write doesn't litter $SKIN_DIR.
    trap 'rm -f "$SKIN_TMP"' EXIT
    if write_skin; then
        log "OK: slug='${SLUG}' skin written → $SKIN_FILE (mode=$mode, source=$SOURCE_DESC, colors=$COLORS)"
    else
        log "ERR: slug='${SLUG}' — failed to write skin"
        exit 0
    fi
    trap - EXIT

    # Active skin switch (no serialisation possible without flock).
    if [ ! -x "$HERMES_BIN" ]; then
        log "WARN: hermes binary not found at $HERMES_BIN — skin file written but not activated"
        exit 0
    fi
    # Capture rc before the if — POSIX fi resets $? to the branch's last cmd.
    "$HERMES_BIN" skin use "$SLUG" >> "$LOG_FILE" 2>&1
    rc=$?
    if [ "$rc" -eq 0 ]; then
        log "OK: hermes skin use $SLUG succeeded"
    else
        log "ERR: hermes skin use $SLUG exited $rc"
    fi
    exit 0  # Never break the hook chain on Hermes-side failure.
fi