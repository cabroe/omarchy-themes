#!/usr/bin/env bash
# tests/theme-switch-smoke.sh — exercises the omarchy → Hermes skin pipeline
# end-to-end against a real Omarchy host.
#
# What this covers that tests/hook.sh cannot:
#   - The Omarchy hook chain actually firing (omarchy-hook → theme-set.d/*).
#   - `omarchy theme set <slug>` returning successfully for both system themes
#     and user-installed themes.
#   - `hermes-skin-sync.sh` running inside an interactive-ish shell and
#     reaching the real ~/.hermes, ~/.local/bin/hermes, and `/etc/profile.d`.
#
# Caveat: non-interactive SSH shells don't source /etc/profile.d/*.sh, so
# OMARCHY_PATH would be empty and `omarchy theme set` would fail on every
# system theme. We explicitly seed OMARCHY_PATH below to keep this script
# honest about which env it needs.
#
# Usage:
#   tests/theme-switch-smoke.sh                                 # defaults
#   tests/theme-switch-smoke.sh nord catppuccin-latte rose-pine # explicit
#
# Make target: `make theme-smoke` (HOST=... THEMES="..." overrides).
#
# Exit codes: 0 = all PASS · 1 = at least one FAIL or infra problem.
set -u

# --- Resolve OMARCHY_PATH even when the parent shell is non-interactive ---
# Non-interactive SSH doesn't source /etc/profile.d/*.sh, so OMARCHY_PATH is
# empty by default and `omarchy theme set` can only see user themes. Pull
# the canonical Omarchy installer profile in ourselves if it exists. The
# disable is needed because the file only exists on an Omarchy host, not
# on the local lint runner.
if [ -r /etc/profile.d/omarchy.sh ]; then
  # shellcheck disable=SC1091
  . /etc/profile.d/omarchy.sh
elif [ -r /etc/profile.d/omarchy.bash ]; then
  # shellcheck disable=SC1091
  . /etc/profile.d/omarchy.bash
fi
export OMARCHY_PATH="${OMARCHY_PATH:-/usr/share/omarchy}"

# --- Defaults: broad cross-section, system + user, light + dark --------------
DEFAULT_THEMES=(nord catppuccin-latte rose-pine gruvbox hackerman kanagawa
                last-horizon tokyo-night flexoki-light aetheria cpunk)

if [ "$#" -gt 0 ]; then
  TEST_THEMES=("$@")
else
  TEST_THEMES=("${DEFAULT_THEMES[@]}")
fi
TOTAL=${#TEST_THEMES[@]}

# --- Pre-flight --------------------------------------------------------------
command -v omarchy >/dev/null  || { echo "FAIL: omarchy CLI not on PATH" >&2; exit 1; }
command -v hermes   >/dev/null  || { echo "FAIL: hermes CLI not on PATH"  >&2; exit 1; }

LOG="${HOME}/.hermes/logs/omarchy-theme-sync.log"
SKIN_DIR="${HOME}/.hermes/skins"
mkdir -p "$(dirname "$LOG")" "$SKIN_DIR" || true

# Capture the currently active skin so we can restore at the end.
ACTIVE_BEFORE=$(hermes skin list 2>/dev/null | awk '/^\*/{print $2}')
printf 'ACTIVE_BEFORE=%s\n' "${ACTIVE_BEFORE:-<none>}"
printf 'OMARCHY_PATH=%s\n' "$OMARCHY_PATH"
printf 'TEST_THEMES=%s\n' "${TEST_THEMES[*]}"

# Fresh log so this run's entries are easy to grep.
: > "$LOG"

# --- Per-theme loop ----------------------------------------------------------
PASS=0
FAIL=0
for slug in "${TEST_THEMES[@]}"; do
  printf '\n========================================\nTEST: %s\n========================================\n' "$slug"

  if ! out=$(omarchy theme set "$slug" 2>&1); then
    printf 'FAIL: omarchy theme set exited %s: %s\n' "$?" "$out"
    FAIL=$((FAIL + 1))
    continue
  fi

  # Hook chain runs serially; give it a brief settle.
  sleep 1

  SKIN="$SKIN_DIR/${slug}.yaml"
  if [ ! -s "$SKIN" ]; then
    printf 'FAIL: skin file missing/empty at %s\n' "$SKIN"
    FAIL=$((FAIL + 1))
    continue
  fi

  ACTIVE_NOW=$(hermes skin list 2>/dev/null | awk '/^\*/{print $2}')
  if [ "$ACTIVE_NOW" != "$slug" ]; then
    printf 'FAIL: active skin is "%s", expected "%s"\n' "${ACTIVE_NOW:-<none>}" "$slug"
    FAIL=$((FAIL + 1))
    continue
  fi

  # Required colours present and well-formed (#rrggbb). Skip on first failure.
  bad=""
  for k in background ui_accent ui_text; do
    v=$(awk -v K="$k:" '$1 == K { print $2; exit }' "$SKIN" | tr -d '"')
    if ! printf '%s' "$v" | grep -qE '^#[0-9a-f]{6}$'; then
      bad="$bad $k=$v"
    fi
  done
  if [ -n "$bad" ]; then
    printf 'FAIL: missing/malformed keys:%s\n' "$bad"
    FAIL=$((FAIL + 1))
    continue
  fi

  mode=$(grep -m1 '^description:' "$SKIN"  | sed -E 's/.*\((dark|light)\).*/\1/')
  nkeys=$(grep -cE '^  [a-z_]+: "#[0-9a-fA-F]{6}"' "$SKIN")
  bg=$(awk   '/^  background:/{print $2}'  "$SKIN" | tr -d '"')
  acc=$(awk  '/^  ui_accent:/{print $2}'    "$SKIN" | tr -d '"')
  printf 'PASS: mode=%s keys=%s bg=%s accent=%s active=%s\n' \
    "$mode" "$nkeys" "$bg" "$acc" "$ACTIVE_NOW"
  PASS=$((PASS + 1))
done

# --- Summary -----------------------------------------------------------------
printf '\n=========================================\n'
printf 'SUMMARY: PASS=%d FAIL=%d of %d\n' "$PASS" "$FAIL" "$TOTAL"
printf '=========================================\n\n'

printf '=== ERR / WARN / SKIP in this run ===\n'
if grep -E '\b(ERR|WARN|SKIP)\b' "$LOG"; then :; else printf '(none)\n'; fi

# --- Restore -----------------------------------------------------------------
if [ -n "${ACTIVE_BEFORE:-}" ]; then
  printf '\n=== Restoring ACTIVE_BEFORE=%s ===\n' "$ACTIVE_BEFORE"
  if ! omarchy theme set "$ACTIVE_BEFORE" >/dev/null 2>&1; then
    printf 'omarchy rejected %s — falling back to direct hermes skin use\n' "$ACTIVE_BEFORE"
    hermes skin use "$ACTIVE_BEFORE" 2>&1 | tail -2 || true
  fi
  ACTIVE_AFTER=$(hermes skin list 2>/dev/null | awk '/^\*/{print $2}')
  printf 'ACTIVE_AFTER=%s\n' "$ACTIVE_AFTER"
fi

# Exit non-zero on any FAIL so `make theme-smoke` surfaces a hard error.
[ "$FAIL" -eq 0 ]
