#!/bin/sh
# Kalibrierung des SKIP-Verhaltens von `make pages-check`.
#
# Hintergrund: ohne gh-pages-Checkout ueberspringt das Target das Drift-Gate.
# Das ist gewollt — `make check` bleibt auf jedem Host gruen, und CI erzwingt das
# Gate (.github/workflows/pages-consistency.yml) —, war aber nur eine Zeile "SKIP":
# im Log eines Abnahme-Laufs nicht von "Gate gelaufen" zu unterscheiden
# (Befund aus der QA-Abnahme t_1048777b). Seit dem Fix gilt: der Skip sagt
# unuebersehbar "PAGES DRIFT GATE DID NOT RUN" und nennt CI sowie PAGES_STRICT,
# und mit PAGES_STRICT=1 ist ein fehlender Checkout ein harter Fehler (Exit 2).
#
#   sh tests/pages-check-enforcement.sh
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
MISSING="$ROOT/.no-such-pages-dir-for-test"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

# 1. Fehlender Checkout ohne PAGES_STRICT: Exit 0, aber unuebersehbar als Skip.
out=$(cd "$ROOT" && make -s pages-check PAGES_DIR="$MISSING" 2>&1) && code=0 || code=$?
[ "$code" -eq 0 ] || fail "skip-Fall: Exit $code, erwartet 0"
case $out in *"DID NOT RUN"*) ;; *) fail "skip-Fall: Warnung 'DID NOT RUN' fehlt: $out" ;; esac
case $out in *"PAGES_STRICT"*) ;; *) fail "skip-Fall: Hinweis auf PAGES_STRICT fehlt: $out" ;; esac
case $out in *"pages-consistency.yml"*) ;; *) fail "skip-Fall: CI-Verweis fehlt: $out" ;; esac
printf 'ok — skip ist laut und nennt CI + PAGES_STRICT (exit %s)\n' "$code"

# 2. PAGES_STRICT=1 als make-Variable: harter Fehler.
out=$(cd "$ROOT" && make -s pages-check PAGES_DIR="$MISSING" PAGES_STRICT=1 2>&1) && code=0 || code=$?
[ "$code" -ne 0 ] || fail "strict-Fall (make-Variable): Exit 0, erwartet != 0"
case $out in *"FAIL"*) ;; *) fail "strict-Fall (make-Variable): FAIL-Zeile fehlt: $out" ;; esac
printf 'ok — PAGES_STRICT als make-Variable erzwingt den Fehler (exit %s)\n' "$code"

# 3. PAGES_STRICT=1 aus der Umgebung: muss genauso wirken.
out=$(cd "$ROOT" && PAGES_STRICT=1 PAGES_DIR="$MISSING" make -s pages-check 2>&1) && code=0 || code=$?
[ "$code" -ne 0 ] || fail "strict-Fall (Umgebung): Exit 0, erwartet != 0"
printf 'ok — PAGES_STRICT aus der Umgebung wirkt (exit %s)\n' "$code"

printf 'ok — pages-check enforcement: 3 Faelle\n'
