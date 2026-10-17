#!/usr/bin/env python3
"""Regenerate the baked-in theme table in plugin/desktop/plugin.js.

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
import re
import subprocess
import sys
import tomllib
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PLUGIN_JS = REPO / "plugin" / "desktop" / "plugin.js"

SYSTEM_DIR = "/usr/share/omarchy/themes"
USER_DIR = "~/.config/omarchy/themes"

BEGIN = "// BEGIN GENERATED THEMES"
END = "// END GENERATED THEMES"

# Keys copied from colors.toml, in output order. Anything else is ignored.
KEYS = [
    "mode", "accent", "selection", "muted",
    "background", "dark_background", "darker_background", "lighter_background",
    "foreground", "dark_foreground", "bright_foreground",
    "red", "yellow", "green", "cyan", "blue", "magenta",
    "bright_red", "bright_yellow", "bright_green", "bright_cyan", "bright_blue", "bright_magenta",
]
REQUIRED = ("background", "foreground", "accent")
HEX = re.compile(r"^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def norm_hex(value: str) -> str | None:
    m = HEX.match(value.strip())
    if not m:
        return None
    h = m.group(1).lower()
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    return "#" + h


def parse_palette(slug: str, text: str) -> dict[str, str] | None:
    try:
        data = tomllib.loads(text)
    except tomllib.TOMLDecodeError as exc:
        print(f"  skip {slug}: invalid TOML ({exc})", file=sys.stderr)
        return None
    out: dict[str, str] = {}
    for key in KEYS:
        val = data.get(key)
        if not isinstance(val, str):
            continue
        if key == "mode":
            out[key] = "light" if val.strip().lower() == "light" else "dark"
        elif (h := norm_hex(val)) is not None:
            out[key] = h
    missing = [k for k in REQUIRED if k not in out]
    if missing:
        print(f"  skip {slug}: missing {', '.join(missing)}", file=sys.stderr)
        return None
    out.setdefault("mode", "dark")
    return out


def read_local(directory: str) -> dict[str, str]:
    root = Path(directory).expanduser()
    if not root.is_dir():
        return {}
    return {
        p.parent.name: p.read_text(encoding="utf-8")
        for p in sorted(root.glob("*/colors.toml"))
    }


def read_remote(host: str, directory: str) -> dict[str, str]:
    # One SSH round-trip per directory: emit "@@@ <slug>" headers + file bodies.
    script = (
        f'cd {directory} 2>/dev/null || exit 0; '
        'for f in */colors.toml; do [ -f "$f" ] || continue; '
        'printf "@@@ %s\\n" "${f%/colors.toml}"; cat "$f"; echo; done'
    )
    res = subprocess.run(["ssh", host, script], capture_output=True, text=True, check=True)
    files: dict[str, str] = {}
    slug = None
    for line in res.stdout.splitlines(keepends=True):
        if line.startswith("@@@ "):
            slug = line[4:].strip()
            files[slug] = ""
        elif slug is not None:
            files[slug] += line
    return files


def render(palettes: dict[str, dict[str, str]], sources: list[str]) -> str:
    width = max(len(s) for s in palettes) + 4  # quotes + comma + one space
    lines = [
        BEGIN + " — do not edit by hand, run scripts/generate-themes.py",
        f"// {len(palettes)} themes from {', '.join(sources)}",
        "const RAW = [",
    ]
    for slug in sorted(palettes):
        c = palettes[slug]
        slug_field = f"'{slug}',".ljust(width)
        mode_field = f"'{c['mode']}',".ljust(9)  # aligns 'dark' and 'light'
        rest = ", ".join(f"{k}:'{c[k]}'" for k in KEYS[1:] if k in c)
        lines.append(f"  {{ slug:{slug_field}c:{{ mode:{mode_field}{rest} }} }},")
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
    raw: dict[str, str] = {}
    for d in dirs:  # later dirs override earlier ones
        found = read_remote(args.remote, d) if args.remote else read_local(d)
        print(f"{len(found):3d} colors.toml in {d}", file=sys.stderr)
        raw.update(found)

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
