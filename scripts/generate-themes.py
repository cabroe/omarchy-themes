#!/usr/bin/env python3
"""Regenerate the baked-in theme table in desktop/plugin.js.

Reads every ``<theme>/colors.toml`` from the Omarchy theme directories and
rewrites the block between the ``BEGIN/END GENERATED THEMES`` markers in
plugin.js. Everything outside the markers is left untouched.

Usage (from the repo root):

    # on the omarchy host itself
    scripts/generate-themes.py

    # from any other machine — read the theme files over SSH
    scripts/generate-themes.py --remote omarchy

    # also include custom themes from ~/.config/omarchy/themes
    scripts/generate-themes.py --remote omarchy --include-user

    # CI / pre-push: exit 1 if plugin.js is out of date
    scripts/generate-themes.py --remote omarchy --check

Requires Python 3.11+ (tomllib).
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PLUGIN_JS = REPO / "desktop" / "plugin.js"

SYSTEM_DIR = "/usr/share/omarchy/themes"
USER_DIR = "~/.config/omarchy/themes"

BEGIN = "// BEGIN GENERATED THEMES"
END = "// END GENERATED THEMES"
# Section marker in remote/derived output. Long enough to never appear inside
# an omarchy-theme-color value (which prints a single key per line).
SECTION_MARKER = "@@@OMARCHY-THEMES-START"

# Keys copied from colors.toml, in output order. Anything else is ignored.
KEYS = [
    "mode", "accent", "selection", "muted",
    "background", "dark_background", "darker_background", "lighter_background",
    "foreground", "dark_foreground", "bright_foreground",
    "red", "yellow", "green", "cyan", "blue", "magenta",
    "bright_red", "bright_yellow", "bright_green", "bright_cyan", "bright_blue", "bright_magenta",
]
REQUIRED = ("background", "foreground", "accent")
# Themes missing these would render with placeholder/fallback colors for
# half the UI — not worth including even if --include-user finds them.
REQUIRED_ANSI = ("red", "yellow", "green", "cyan", "blue", "magenta")

# Aliases some themes use instead of the canonical names. The plugin's
# `paletteFromToml` already applies the same fallbacks for the live
# `current/theme/colors.toml` path; the generator must produce a baked
# table that matches what the live path would render for the same theme.
ALIASES: dict[str, tuple[str, ...]] = {
    "accent": ("color4",),
    "selection": ("selection_background",),
    "muted": ("color8",),
    "background": ("color0",),
    "foreground": ("color7",),
    "dark_foreground": ("color8",),
    "bright_foreground": ("color15",),
    "red":     ("color1", "orange"),
    "green":   ("color2",),
    "yellow":  ("color3",),
    "blue":    ("color4", "color12"),
    "magenta": ("color5", "color13"),
    "cyan":    ("color6", "color14"),
    "bright_red":     ("color9",),
    "bright_green":   ("color10",),
    "bright_yellow":  ("color11",),
    "bright_blue":    ("color12",),
    "bright_magenta": ("color13",),
    "bright_cyan":    ("color14",),
}
HEX = re.compile(r"^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def norm_hex(value: str) -> str | None:
    m = HEX.match(value.strip())
    if not m:
        return None
    h = m.group(1).lower()
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    return "#" + h


def luma(hex_color: str) -> float:
    """Rec.709 luma in [0, 1]. Mirrors plugin.js luma() so mode fallback agrees."""
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def parse_palette(slug: str, text: str) -> dict[str, str] | None:
    try:
        data = tomllib.loads(text)
    except tomllib.TOMLDecodeError as exc:
        print(f"  skip {slug}: invalid TOML ({exc})", file=sys.stderr)
        return None
    out: dict[str, str] = {}
    for key in KEYS:
        val = data.get(key)
        if isinstance(val, str):
            if key == "mode":
                out[key] = "light" if val.strip().lower() == "light" else "dark"
                continue
            if (h := norm_hex(val)) is not None:
                out[key] = h
                continue
        # Fall back to aliases when the canonical key is missing or not a hex
        for alias in ALIASES.get(key, ()):
            val = data.get(alias)
            if isinstance(val, str) and (h := norm_hex(val)) is not None:
                out[key] = h
                break
    missing = [k for k in REQUIRED if k not in out]
    if missing:
        print(f"  skip {slug}: missing {', '.join(missing)}", file=sys.stderr)
        return None
    missing_ansi = [k for k in REQUIRED_ANSI if k not in out]
    if missing_ansi:
        print(f"  skip {slug}: incomplete palette, missing {', '.join(missing_ansi)}", file=sys.stderr)
        return None
    # Mode fallback: missing/invalid `mode` keys default to the background's
    # Rec.709 luma (> 0.5 = light), matching the plugin's paletteFromToml and
    # the renderer's renderedModeFor. The hook instead mirrors Omarchy's
    # resolve_theme_mode (raw R+G+B > 382), which only feeds the skin
    # `description:` line — see tests/palette-parity.sh.
    if "mode" not in out:
        out["mode"] = "light" if luma(out["background"]) > 0.5 else "dark"
    return out


def read_local(directory: str) -> dict[str, str]:
    root = Path(directory).expanduser()
    if not root.is_dir():
        return {}
    return {
        p.parent.name: p.read_text(encoding="utf-8")
        for p in sorted(root.glob("*/colors.toml"))
    }


def _ssh_cmd(host: str, script: str) -> list[str]:
    return [
        "ssh",
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=3",
        host,
        script,
    ]


def read_remote(host: str, directory: str) -> dict[str, str]:
    # One SSH round-trip per directory: emit section headers + file bodies.
    script = (
        f'cd {directory} 2>/dev/null || exit 0; '
        'for f in */colors.toml; do [ -f "$f" ] || continue; '
        f'printf "{SECTION_MARKER} %s\\n" "${{f%/colors.toml}}"; cat "$f"; echo; done'
    )
    try:
        res = subprocess.run(_ssh_cmd(host, script), capture_output=True, text=True, check=False)
    except FileNotFoundError as exc:
        print(f"ssh not available: {exc}", file=sys.stderr)
        return {}
    if res.returncode != 0:
        print(f"ssh {host} {directory!r} failed (rc={res.returncode}): {res.stderr.strip()}", file=sys.stderr)
        return {}
    return parse_sections(res.stdout)


# Themes that ship no colors.toml (only an alacritty.toml) still get applied by
# Omarchy: omarchy-theme-set generates the colors.toml from the terminal palette
# and resolves the derived keys (muted, dark_background, mode, ...). Reuse its
# own tools so the baked palette is exactly what Omarchy applies. Needs the
# omarchy CLI on the host; without it nothing is derived.
DERIVE_SCRIPT = (
    'cd {directory} 2>/dev/null || exit 0; '
    'command -v omarchy-theme-colors-from-alacritty >/dev/null && command -v omarchy-theme-color >/dev/null || exit 0; '
    'for d in */; do d=${{d%/}}; [ -f "$d/colors.toml" ] && continue; [ -f "$d/alacritty.toml" ] || continue; '
    't=$(mktemp -d); cp "$d/alacritty.toml" "$t/"; '
    'omarchy-theme-colors-from-alacritty "$t" >/dev/null 2>&1; '
    'if [ -f "$t/colors.toml" ]; then '
    f'printf "{SECTION_MARKER} %s\\n" "$d"; '
    'omarchy-theme-color --file "$t/colors.toml" --all | awk -F"\\t" \'{{printf "%s = \\"%s\\"\\n", $1, $2}}\'; echo; fi; '
    'rm -rf "$t"; done'
)


def read_derived(host: str | None, directory: str) -> dict[str, str]:
    script = DERIVE_SCRIPT.format(directory=directory)
    cmd = _ssh_cmd(host, script) if host else ["bash", "-c", script]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except FileNotFoundError as exc:
        print(f"shell not available: {exc}", file=sys.stderr)
        return {}
    if res.returncode != 0:
        # Non-fatal: a host without omarchy CLI simply yields no derived themes.
        return {}
    return parse_sections(res.stdout)


def parse_sections(stdout: str) -> dict[str, str]:
    files: dict[str, str] = {}
    slug = None
    for line in stdout.splitlines(keepends=True):
        marker = SECTION_MARKER + " "
        if line.startswith(marker):
            slug = line[len(marker):].strip()
            files[slug] = ""
        elif slug is not None:
            files[slug] += line
    return files


def render(palettes: dict[str, dict[str, str]], sources: list[str]) -> str:
    # JSON-encode every value (slug + colors) so user-supplied slugs cannot
    # break the generated JS — a slug containing a single quote would
    # otherwise inject a SyntaxError that only `node --check` would catch
    # after `make generate` already wrote it. Keys stay bare (all are safe
    # ASCII identifiers, never a reserved word).
    width = max(len(s) for s in palettes) + 2
    mode_width = 9
    lines = [
        BEGIN + " — do not edit by hand, run scripts/generate-themes.py",
        f"// {len(palettes)} themes from {', '.join(sources)}",
        "const RAW = [",
    ]
    for slug in sorted(palettes):
        c = palettes[slug]
        slug_field = json.dumps(slug).ljust(width)
        mode_field = json.dumps(c["mode"]).ljust(mode_width)
        rest = ", ".join(f"{k}:{json.dumps(c[k])}" for k in KEYS[1:] if k in c)
        lines.append(f"  {{ slug:{slug_field}, c:{{ mode:{mode_field}, {rest} }} }},")
    lines += ["]", END]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--remote", metavar="HOST", help="read theme files from HOST via ssh")
    ap.add_argument("--include-user", action="store_true",
                    help=f"also read {USER_DIR} (user themes win on slug clash)")
    ap.add_argument("--check", action="store_true", help="exit 1 if plugin.js would change")
    ap.add_argument("--plugin", type=Path, default=PLUGIN_JS, help="path to plugin.js")
    args = ap.parse_args()

    dirs = [SYSTEM_DIR] + ([USER_DIR] if args.include_user else [])
    # First pass: read raw `colors.toml` from every directory. User themes win
    # on a slug clash because the loop iterates dirs in order and dict.update
    # keeps the latest write.
    raw: dict[str, str] = {}
    for d in dirs:
        found = read_remote(args.remote, d) if args.remote else read_local(d)
        if not found:
            print(f"  no colors.toml in {d}", file=sys.stderr)
        raw.update(found)

    # Second pass: derive palettes from alacritty.toml for themes that ship
    # NO `colors.toml` in ANY of the scanned directories. Doing it per-dir
    # (the old behaviour) would let a User alacritty-only overlay shadow the
    # System colors.toml of the same slug.
    derived_total = 0
    for d in dirs:
        derived = {s: t for s, t in read_derived(args.remote, d).items() if s not in raw}
        if derived:
            print(f"  +{len(derived)} derived from alacritty.toml in {d}", file=sys.stderr)
            derived_total += len(derived)
            raw.update(derived)

    palettes = {s: p for s, t in raw.items() if (p := parse_palette(s, t)) is not None}
    if not palettes:
        print("no usable themes found — refusing to write an empty table", file=sys.stderr)
        return 2

    src = args.plugin.read_text(encoding="utf-8")
    pattern = re.compile(re.escape(BEGIN) + r".*?" + re.escape(END), re.S)
    if not pattern.search(src):
        print(f"markers not found in {args.plugin}", file=sys.stderr)
        return 2
    new = pattern.sub(lambda _: render(palettes, dirs), src, count=1)

    if new == src:
        print(f"up to date ({len(palettes)} themes)", file=sys.stderr)
        return 0
    if args.check:
        print(f"{args.plugin} is out of date — run scripts/generate-themes.py", file=sys.stderr)
        return 1
    args.plugin.write_text(new, encoding="utf-8")
    print(f"wrote {len(palettes)} themes → {args.plugin}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
