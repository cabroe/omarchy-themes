#!/usr/bin/env python3
"""Read-only consistency gate: hand-maintained gh-pages branch vs. the plugin.

Compares (and exits non-zero on any drift):
  1. Theme set:     slug entries in <pages>/themes.js against the RAW block in
                    desktop/plugin.js minus BUILTIN_NAMES. Prints a plain-text
                    diff table (missing / unexpected / mode mismatch) plus
                    Dark/Light counts.
  2. Skin keys:     SKIN_KEYS constant in <pages>/themes.js against the number
                    of `printf '  key:'` emission lines in
                    hooks/hermes-skin-sync.sh.
  3. Counter prose: no-JS fallback counters #mockTotal and #roPalettes in
                    <pages>/index.html must match the expected theme count.

Parsing note: the RAW block in desktop/plugin.js is *nested* — each entry looks
like `{ slug:"catppuccin", c:{ mode:"dark", accent:"…", … } },` and the `mode`
field lives inside `c:`. A flat `\\{[^{}]*\\}` regex therefore matches the inner
`c:{…}` object instead of the entry. Both sides are parsed with a brace-matching
scanner that skips strings and comments, so nesting depth is irrelevant.

Read-only: writes nothing, calls nothing.
Exit codes: 0 = in sync, 1 = drift, 2 = parse/IO error (unreadable or
unparseable input — never silently treated as drift).
Usage: check-pages-consistency.py [--pages PAGES_DIR] [--root REPO_ROOT]
       (PAGES_DIR env var is honoured when --pages is omitted)
"""

import argparse
import os
import re
import sys
from collections import Counter
from pathlib import Path

# Matches both generated formats:  slug:"x"  (main RAW block, double quotes,
# aligned) and slug:'x' (gh-pages themes.js, single quotes).
SLUG_RE = re.compile(r"""slug:\s*["']([^"']+)["']""")
MODE_RE = re.compile(r"""mode:\s*["'](dark|light)["']""")

EXIT_OK, EXIT_DRIFT, EXIT_PARSE = 0, 1, 2


class ParseError(Exception):
    """Input could not be read or understood — maps to exit code 2."""


def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise ParseError(f"file not found: {path}")
    except OSError as exc:
        raise ParseError(f"cannot read {path}: {exc}")
    except UnicodeDecodeError as exc:
        raise ParseError(f"not valid UTF-8: {path}: {exc}")


def match_bracket(src: str, open_pos: int, open_ch: str, close_ch: str) -> int:
    """Index of the bracket closing the one at open_pos (string/comment aware).

    Skips JS string literals ('' "" ``), line comments and block comments, so a
    brace or bracket inside a colour value or a comment cannot end the block.
    """
    if open_pos >= len(src) or src[open_pos] != open_ch:
        raise ParseError(f"expected {open_ch!r} at offset {open_pos}")
    depth = 0
    i = open_pos
    quote = None
    while i < len(src):
        ch = src[i]
        if quote:
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch in "\"'`":
            quote = ch
            i += 1
            continue
        if ch == "/" and src.startswith("//", i):
            nl = src.find("\n", i)
            i = len(src) if nl == -1 else nl + 1
            continue
        if ch == "/" and src.startswith("/*", i):
            end = src.find("*/", i + 2)
            if end == -1:
                raise ParseError("unterminated block comment")
            i = end + 2
            continue
        if ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ParseError(f"unterminated {open_ch}{close_ch} block")


def top_level_blocks(src: str, array_open_pos: int) -> list[str]:
    """Text of every depth-1 `{...}` object inside the array at array_open_pos."""
    array_end = match_bracket(src, array_open_pos, "[", "]")
    blocks = []
    i = array_open_pos + 1
    while i < array_end:
        ch = src[i]
        if ch in "\"'`":
            quote = ch
            i += 1
            while i < array_end:
                if src[i] == "\\":
                    i += 2
                    continue
                if src[i] == quote:
                    break
                i += 1
            i += 1
            continue
        if ch == "/" and src.startswith("//", i):
            nl = src.find("\n", i)
            i = array_end if nl == -1 else nl + 1
            continue
        if ch == "/" and src.startswith("/*", i):
            end = src.find("*/", i + 2)
            if end == -1:
                raise ParseError("unterminated block comment")
            i = end + 2
            continue
        if ch == "{":
            end = match_bracket(src, i, "{", "}")
            blocks.append(src[i:end + 1])
            i = end + 1
            continue
        i += 1
    return blocks


def find_array_open(src: str, marker: str, what: str, path: Path) -> int:
    start = src.find(marker)
    if start == -1:
        raise ParseError(f"{what} not found in {path}")
    open_pos = src.find("[", start)
    if open_pos == -1:
        raise ParseError(f"{what}: no '[' after marker in {path}")
    return open_pos


def parse_entries(src: str, marker: str, what: str, path: Path) -> list[tuple[str, str]]:
    """[(slug, mode)] from the object array introduced by `marker`."""
    blocks = top_level_blocks(src, find_array_open(src, marker, what, path))
    if not blocks:
        raise ParseError(f"{what} is empty in {path}")
    out = []
    for entry in blocks:
        sm = SLUG_RE.search(entry)
        mm = MODE_RE.search(entry)
        if not sm:
            raise ParseError(f"{what} entry without slug: {entry[:80]!r}")
        if not mm:
            raise ParseError(
                f"{what} entry without mode (expected `mode:\"dark\"|\"light\"` "
                f"inside the entry): {entry[:80]!r}"
            )
        out.append((sm.group(1), mm.group(1)))
    seen = {slug for slug, _ in out}
    if len(seen) != len(out):
        dupes = sorted(s for s, n in Counter(slug for slug, _ in out).items() if n > 1)
        raise ParseError(f"{what} contains duplicate slugs: {', '.join(dupes)}")
    return out


def parse_builtin_names(plugin_src: str, plugin_path: Path) -> set[str]:
    marker = "const BUILTIN_NAMES = new Set("
    start = plugin_src.find(marker)
    if start == -1:
        raise ParseError(f"BUILTIN_NAMES not found in {plugin_path}")
    open_pos = plugin_src.find("[", start)
    if open_pos == -1:
        raise ParseError(f"BUILTIN_NAMES: no '[' after marker in {plugin_path}")
    body = plugin_src[open_pos:match_bracket(plugin_src, open_pos, "[", "]") + 1]
    names = set(re.findall(r"""["']([^"']+)["']""", body))
    if not names:
        raise ParseError(f"BUILTIN_NAMES is empty in {plugin_path}")
    return names


def parse_skin_keys(hook_src: str, hook_path: Path) -> list[str]:
    # Emission lines look like:  printf '  accent:...', ... (one per key).
    keys = re.findall(r"""^\s*printf\s+'  ([a-z_]+):""", hook_src, re.M)
    if not keys:
        raise ParseError(f"no printf '  key:' emission lines found in {hook_path}")
    return keys


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Read-only gh-pages drift gate (theme set, SKIN_KEYS, counters).")
    ap.add_argument("--pages", default=os.environ.get("PAGES_DIR") or "pages",
                    help="checkout dir of gh-pages (default: $PAGES_DIR or ./pages)")
    ap.add_argument("--root", default=".", help="repo root (main branch tree)")
    args = ap.parse_args()

    root = Path(args.root)
    pages = Path(args.pages)

    plugin_path = root / "desktop" / "plugin.js"
    hook_path = root / "hooks" / "hermes-skin-sync.sh"
    themes_path = pages / "themes.js"
    index_path = pages / "index.html"

    try:
        plugin_src = read(plugin_path)
        hook_src = read(hook_path)
        themes_src = read(themes_path)
        index_src = read(index_path)
    except ParseError as exc:
        print(f"PARSE ERROR: {exc}")
        return EXIT_PARSE

    print(f"pages checkout: {pages} (themes.js, index.html)")
    print(f"repo root:      {root}")

    failures = 0

    try:
        # ---- 1. Theme set: RAW minus BUILTIN_NAMES vs. pages/themes.js ------
        raw = parse_entries(plugin_src, "const RAW = ", "RAW", plugin_path)
        builtins = parse_builtin_names(plugin_src, plugin_path)
        page = parse_entries(themes_src, "export const THEMES = ", "THEMES", themes_path)
    except ParseError as exc:
        print(f"PARSE ERROR: {exc}")
        return EXIT_PARSE

    soll = [(slug, mode) for slug, mode in raw if slug not in builtins]
    soll_slugs = {slug for slug, _ in soll}
    soll_mode_map = dict(soll)
    soll_modes = Counter(mode for _, mode in soll)

    page_slugs = [slug for slug, _ in page]
    page_mode_map = dict(page)
    page_set = set(page_slugs)
    page_modes = Counter(mode for _, mode in page)

    missing = sorted(soll_slugs - page_set)      # expected on the page, absent
    extra = sorted(page_set - soll_slugs)        # on the page, not expected
    mode_mismatch = sorted(
        (slug, soll_mode_map[slug], page_mode_map[slug])
        for slug in soll_slugs & page_set
        if soll_mode_map[slug] != page_mode_map[slug]
    )

    print(f"1. Theme set: plugin (RAW minus BUILTIN_NAMES) = {len(soll_slugs)} "
          f"(RAW {len(raw)} - builtin collisions {len(raw) - len(soll_slugs)}), "
          f"pages/themes.js = {len(page_slugs)}")
    if missing or extra or mode_mismatch:
        failures += 1
        print("   FAIL: theme sets diverge")
        print(f"   {'slug':<24} status")
        print(f"   {'-' * 24} {'-' * 40}")
        for slug in missing:
            print(f"   {slug:<24} fehlt (in plugin.js, nicht auf der Seite)")
        for slug in extra:
            print(f"   {slug:<24} ueberzaehlig (auf der Seite, nicht in plugin.js)")
        for slug, want, got in mode_mismatch:
            print(f"   {slug:<24} mode plugin={want} / page={got}")
    else:
        print("   ok: set match")

    print(f"   Dark/Light: plugin = {soll_modes['dark']} dark / {soll_modes['light']} light, "
          f"page = {page_modes['dark']} dark / {page_modes['light']} light")
    if page_modes != soll_modes:
        failures += 1
        print(f"   FAIL: Dark/Light-Zählung weicht ab: plugin {dict(soll_modes)} "
              f"vs page {dict(page_modes)}")
    else:
        print("   ok: Dark/Light counts match")

    # ---- 2. SKIN_KEYS constant vs. hook emission lines ----------------------
    try:
        hook_keys = parse_skin_keys(hook_src, hook_path)
    except ParseError as exc:
        print(f"PARSE ERROR: {exc}")
        return EXIT_PARSE

    sk_m = re.search(r"export const SKIN_KEYS = (\d+)", themes_src)
    if sk_m is None:
        failures += 1
        print(f"2. Skin keys: FAIL: SKIN_KEYS constant not found in {themes_path} "
              f"(hook emits {len(hook_keys)} keys: {', '.join(hook_keys)})")
    else:
        sk_val = int(sk_m.group(1))
        print(f"2. Skin keys: SKIN_KEYS = {sk_val}, hook emission lines = {len(hook_keys)}")
        if sk_val != len(hook_keys):
            failures += 1
            print(f"   FAIL: SKIN_KEYS ({sk_val}) != hook emission lines ({len(hook_keys)})")
        else:
            print("   ok: match")

    # ---- 3. Counter prose: #mockTotal / #roPalettes fallbacks ---------------
    print(f"3. Counter prose: expected no-JS fallback = {len(soll_slugs)}")
    for el_id in ("mockTotal", "roPalettes"):
        m = re.search(rf'id="{el_id}">(\d+)<', index_src)
        if m is None:
            failures += 1
            print(f"   FAIL: #{el_id} not found in {index_path}")
            continue
        val = int(m.group(1))
        if val != len(soll_slugs):
            failures += 1
            print(f"   FAIL: #{el_id} = {val}, expected {len(soll_slugs)}")
        else:
            print(f"   ok: #{el_id} = {val}")

    if failures:
        print(f"\nFAIL: {failures} check(s) failed — gh-pages has drifted from main.")
        return EXIT_DRIFT
    print("\nPASS: gh-pages in sync with the plugin (theme set, SKIN_KEYS, counters).")
    return EXIT_OK


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ParseError as exc:          # defensive: never surface as exit 1
        print(f"PARSE ERROR: {exc}")
        sys.exit(EXIT_PARSE)
