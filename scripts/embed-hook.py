#!/usr/bin/env python3
"""Embed hooks/hermes-skin-sync.sh into desktop/plugin.js.

A disk-mode install ships only ``plugin.js`` into ``~/.hermes/desktop-plugins/<id>/``,
so the renderer cannot read the hook from the package. The plugin therefore
carries the hook source as a generated constant and writes it with
``window.hermesDesktop.writeTextFile`` when the user clicks "Installieren".

The block lives between the BEGIN/END GENERATED HOOK markers in plugin.js.

Usage:
    scripts/embed-hook.py            # rewrite the block
    scripts/embed-hook.py --check    # exit 1 if it would change
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HOOK = REPO / "hooks" / "hermes-skin-sync.sh"
PLUGIN = REPO / "desktop" / "plugin.js"

BEGIN = "// BEGIN GENERATED HOOK — do not edit by hand, run scripts/embed-hook.py"
END = "// END GENERATED HOOK"


def render(script: str) -> str:
    lines = script.split("\n")
    # A trailing newline produces one empty element; drop it so the join
    # reproduces the file byte for byte (minus the final newline).
    if lines and lines[-1] == "":
        lines = lines[:-1]
    body = ",\n".join("  " + json.dumps(line) for line in lines)
    return "\n".join(
        [
            BEGIN,
            "const HOOK_SCRIPT = [",
            body,
            "].join('\\n')",
            END,
        ]
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="exit 1 if plugin.js would change")
    ap.add_argument("--plugin", type=Path, default=PLUGIN, help="path to plugin.js")
    args = ap.parse_args()

    script = HOOK.read_text(encoding="utf-8")
    block = render(script)
    src = args.plugin.read_text(encoding="utf-8")

    start = src.find(BEGIN)
    end = src.find(END)
    if start == -1 or end == -1 or end < start:
        print(f"markers not found in {args.plugin}", file=sys.stderr)
        return 2

    new = src[:start] + block + src[end + len(END):]
    if new == src:
        print(f"hook embed up to date ({len(script)} bytes)", file=sys.stderr)
        return 0
    if args.check:
        print(f"{args.plugin} hook embed is out of date — run scripts/embed-hook.py", file=sys.stderr)
        return 1
    args.plugin.write_text(new, encoding="utf-8")
    print(f"embedded {len(script)} bytes of hook → {args.plugin}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
