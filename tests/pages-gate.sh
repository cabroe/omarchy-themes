#!/bin/sh
# Kalibrierung des gh-pages-Drift-Gates (scripts/check-pages-consistency.py).
#
# Baut pro Fall ein synthetisches Mini-Repo (desktop/plugin.js, hooks/…,
# pages/themes.js, pages/index.html) in ein temporaeres Verzeichnis und prueft
# den Exit-Code des Gates. Kein gh-pages-Checkout, kein Netz, kein Omarchy —
# laeuft deshalb in `make check` auf jedem Host.
#
# Warum das Gate einen Test braucht: die Exit-Codes sind der Kontrakt, auf den
# CI und `make pages-check` bauen (0 = in sync, 1 = Drift, 2 = Parse/IO).
# Ohne diese Kalibrierung wuerde eine Verschiebung (z. B. Duplikat wieder als
# Parse-Fehler, oder der Farbabgleich faellt still raus) erst in einem echten
# CI-Lauf auffallen.
#
#   sh tests/pages-gate.sh
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
GATE="$ROOT/scripts/check-pages-consistency.py"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/pages-gate.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

# mutate <file> <sed-script> — in-place, ohne sed -i (BSD/GNU-neutral).
mutate() {
    sed "$2" "$1" > "$1.tmp"
    mv "$1.tmp" "$1"
}

# fixture <dir> — schreibt ein sauberes, in sich konsistentes Mini-Repo:
# 2 registrierte Themes (alpha/beta) + 1 Builtin (github, wird abgezogen),
# 3 Skin-Keys, Zaehler 2. Die Farbwerte sind auf beiden Seiten identisch.
fixture() {
    dir=$1
    mkdir -p "$dir/desktop" "$dir/hooks" "$dir/pages"

    cat > "$dir/desktop/plugin.js" <<'JS'
// Fixture — nur die Struktur, die das Gate parst (RAW + BUILTIN_NAMES).
const BUILTIN_NAMES = new Set([
  'github', 'nous',
])

const RAW = [
  { slug:"alpha" , c:{ mode:"dark" , accent:"#89b4fa", background:"#1e1e2e", foreground:"#cdd6f4" } },
  { slug:"beta"  , c:{ mode:"light", accent:"#1e66f5", background:"#eff1f5", foreground:"#4c4f69" } },
  { slug:"github", c:{ mode:"dark" , accent:"#ff0000", background:"#000000", foreground:"#ffffff" } },
]
JS

    cat > "$dir/hooks/hermes-skin-sync.sh" <<'SH'
#!/bin/sh
# Fixture — nur die Emissionszeilen, die das Gate zaehlt.
printf '  accent: %s\n' "$1"
printf '  background: %s\n' "$1"
printf '  foreground: %s\n' "$1"
SH

    cat > "$dir/pages/themes.js" <<'JS'
// GENERATED from desktop/plugin.js. Do not edit by hand.
export const THEMES = [
  { slug:'alpha', mode:'dark', c:{accent:'#89b4fa',background:'#1e1e2e',foreground:'#cdd6f4'} },
  { slug:'beta', mode:'light', c:{accent:'#1e66f5',background:'#eff1f5',foreground:'#4c4f69'} },
];
export const SKIN_KEYS = 3;
JS

    cat > "$dir/pages/index.html" <<'HTML'
<dd id="mockTotal">2</dd>
<dd id="roPalettes">2</dd>
HTML
}

# expect <dir> <name> <erwarteter-exit> [<substring im Output>...]
expect() {
    dir=$1
    name=$2
    want=$3
    shift 3
    got=0
    out=$(python3 "$GATE" --pages "$dir/pages" --root "$dir" 2>&1) || got=$?
    if [ "$got" -ne "$want" ]; then
        printf '%s\n' "$out" >&2
        fail "$name: Gate-Exit $got, erwartet $want"
    fi
    for text in "$@"; do
        case $out in
            *"$text"*) ;;
            *)
                printf '%s\n' "$out" >&2
                fail "$name: Ausgabe enthaelt '$text' nicht"
                ;;
        esac
    done
    printf 'ok — %s: exit %s\n' "$name" "$got"
}

# 1. Sauberer Stand: Exit 0. Die zweite Erwartung haelt den Farbabgleich
#    kalibriert — faellt er still aus dem Gate, wird dieser Fall rot.
CASE="$WORK/clean"
fixture "$CASE"
expect "$CASE" "sauber" 0 "PASS:" "2 shared themes × 3 keys"

# 2. Theme fehlt auf der Seite: Inhaltsdrift, Exit 1.
CASE="$WORK/theme-missing"
fixture "$CASE"
mutate "$CASE/pages/themes.js" "/slug:'beta'/d"
mutate "$CASE/pages/index.html" "s/>2</>1</"
expect "$CASE" "Theme fehlt" 1 "FAIL" "beta" "fehlt"

# 3. Reine Farbmutation auf der Seite: Exit 1 mit Slug und Key.
CASE="$WORK/color-mutation"
fixture "$CASE"
mutate "$CASE/pages/themes.js" "s/accent:'#89b4fa'/accent:'#FF00FF'/"
expect "$CASE" "Farbmutation" 1 "Farbwerte weichen ab" "alpha" "accent" "#ff00ff"

# 4. SKIN_KEYS verstellt: Exit 1.
CASE="$WORK/skin-keys"
fixture "$CASE"
mutate "$CASE/pages/themes.js" "s/SKIN_KEYS = 3/SKIN_KEYS = 9/"
expect "$CASE" "SKIN_KEYS verstellt" 1 "SKIN_KEYS (9)"

# 5. Doppelter Slug auf der Seite: Inhaltsdrift, Exit 1 (nicht 2).
CASE="$WORK/duplicate"
fixture "$CASE"
mutate "$CASE/pages/themes.js" "/slug:'alpha'/p"
expect "$CASE" "Duplikat" 1 "doppelte Slugs" "alpha"

# 6. Leere Datei: unlesbare Eingabe, Exit 2.
CASE="$WORK/empty"
fixture "$CASE"
: > "$CASE/pages/themes.js"
expect "$CASE" "leere Datei" 2 "PARSE ERROR"

# 7. Abgeschnittene Datei (Array nicht geschlossen): Exit 2.
CASE="$WORK/truncated"
fixture "$CASE"
head -c 120 "$CASE/pages/themes.js" > "$CASE/pages/themes.js.cut"
mv "$CASE/pages/themes.js.cut" "$CASE/pages/themes.js"
expect "$CASE" "abgeschnittene Datei" 2 "PARSE ERROR"

echo "ok — pages gate calibration: 7 Faelle, Exit-Codes 0/1/2 wie spezifiziert"
