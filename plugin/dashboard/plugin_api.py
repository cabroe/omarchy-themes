"""omarchy-themes — Hermes-Desktop theme bridge backend.

Scans Omarchy theme directories (``/usr/share/omarchy/themes`` by default,
plus anything under ``~/.config/omarchy/themes``), parses each
``colors.toml``, and maps the keys to the ``DesktopTheme`` shape the
Hermes-Desktop skin registry expects. Mounted at
``/api/plugins/omarchy-themes/`` by the gateway loader.

The endpoint set:

  GET  /themes       — list ``[{slug, label, mode, theme}, ...]``
  GET  /themes/{slug} — single ``DesktopTheme`` (404 on unknown slug)
  POST /rescan        — invalidate the in-memory cache and rescan

Configuration: override the default search paths with the
``OMARCHY_THEME_PATHS`` env var (comma-separated). A path beginning with
``~`` is expanded against the current user's home; non-existent paths
are skipped (info log), not fatal.

Dependencies: stdlib only (``tomllib`` since Python 3.11). No new
packages required — FastAPI is already in the Hermes stack.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query

log = logging.getLogger(__name__)

router = APIRouter()


# --- Built-in theme-name collision guard -----------------------------------
# These names live in the desktop app's BUILTIN_THEMES map; a contributed
# theme that shares one is silently filtered out by user-themes.ts. We
# append ``-omarchy`` so the contribution actually surfaces in the picker.
# Mirrors `apps/desktop/src/themes/presets.ts`; update both when built-ins change.
BUILTIN_THEME_NAMES: frozenset[str] = frozenset({
    "github", "nous", "nous-alt", "catppuccin", "everforest", "solarized",
    "classic", "midnight", "ember", "mono", "cyberpunk", "slate",
})


# --- Configuration ---------------------------------------------------------

_DEFAULT_PATHS: tuple[str, ...] = (
    "/usr/share/omarchy/themes",
    "~/.config/omarchy/themes",
)

_CACHE_TTL_SECONDS = 300  # 5 minutes


def _configured_paths() -> list[str]:
    """Return the user-configured search paths (env override wins)."""
    override = os.environ.get("OMARCHY_THEME_PATHS", "").strip()
    if override:
        return [p.strip() for p in override.split(",") if p.strip()]
    return list(_DEFAULT_PATHS)


# --- Theme record + cache --------------------------------------------------

@dataclass(frozen=True)
class ThemeRecord:
    """One parsed Omarchy theme, ready for the desktop plugin."""

    slug: str
    label: str
    mode: str  # "dark" | "light"
    theme: dict[str, Any]


@dataclass
class _Cache:
    """Tiny TTL cache with atomic invalidation.

    The list is published as an immutable tuple on every swap so the
    HTTP handler that holds a reference can't observe a torn write.
    """

    snapshot: tuple[ThemeRecord, ...] = ()
    fetched_at: float = 0.0
    lock: threading.Lock = field(default_factory=threading.Lock)

    def get(self, ttl: float) -> tuple[ThemeRecord, ...] | None:
        with self.lock:
            if self.snapshot and (time.monotonic() - self.fetched_at) < ttl:
                return self.snapshot
            return None

    def publish(self, items: list[ThemeRecord]) -> tuple[ThemeRecord, ...]:
        frozen = tuple(items)
        with self.lock:
            self.snapshot = frozen
            self.fetched_at = time.monotonic()
        return frozen

    def invalidate(self) -> None:
        with self.lock:
            self.snapshot = ()
            self.fetched_at = 0.0


_cache = _Cache()


# --- Hex helpers -----------------------------------------------------------

def _normalize_hex(value: Any) -> str | None:
    """Coerce ``value`` to a canonical ``#rrggbb`` string or return ``None``.

    Accepts 3-digit (``#fff`` / ``fff``) and 6-digit forms with or without
    a leading ``#``. Case-insensitive. Anything else is rejected (logged
    by the caller).
    """
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw:
        return None
    if raw.startswith("#"):
        raw = raw[1:]
    if not all(c in "0123456789abcdefABCDEF" for c in raw):
        return None
    lower = raw.lower()
    if len(lower) == 3:
        lower = "".join(ch * 2 for ch in lower)
    if len(lower) != 6:
        return None
    return "#" + lower


def _contrast_for(background_hex: str | None, accent_hex: str | None) -> str | None:
    """Pick the on-accent foreground: white or black by relative luminance."""
    if not background_hex and not accent_hex:
        return None
    candidate = background_hex or accent_hex
    if candidate is None:
        return None
    h = candidate.lstrip("#")
    if len(h) != 6:
        return None
    try:
        r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    except ValueError:
        return None
    # Rec. 709 luma, simplified — close enough for the foreground pick.
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return "#ffffff" if luma < 0.55 else "#000000"


# --- Slug → label ----------------------------------------------------------

def _label_from_slug(slug: str) -> str:
    """``catppuccin-latte`` → ``Catppuccin Latte`` (also handles ``_``)."""
    parts: list[str] = []
    for chunk in slug.replace("_", "-").split("-"):
        if not chunk:
            continue
        parts.append(chunk[:1].upper() + chunk[1:].lower())
    return " ".join(parts) if parts else slug


def _unique_name(slug: str, taken: set[str]) -> str:
    """Return a theme name that doesn't collide with built-ins or earlier picks."""
    candidate = slug
    if candidate in BUILTIN_THEME_NAMES or candidate in taken:
        candidate = f"{slug}-omarchy"
    while candidate in taken:
        candidate = f"{candidate}-dup"
    return candidate


# --- Theme mapping ---------------------------------------------------------

def _build_theme(slug: str, raw: dict[str, Any], taken: set[str]) -> ThemeRecord | None:
    """Map a parsed ``colors.toml`` dict to a ``ThemeRecord``.

    Returns ``None`` when the source is unusable (missing the required
    three colors). Tolerates empty / partial inputs.
    """
    # Hex-normalize every string we know about; warn on the unexpected.
    normalized: dict[str, str] = {}
    for key, value in raw.items():
        if not isinstance(value, str):
            continue
        out = _normalize_hex(value)
        if out is None:
            log.debug("omarchy-themes: drop non-hex value %s=%r in %s", key, value, slug)
            continue
        normalized[key] = out

    background = normalized.get("background")
    foreground = normalized.get("foreground")
    accent = normalized.get("accent")
    if not (background and foreground and accent):
        log.warning("omarchy-themes: skip %s (missing background/foreground/accent)", slug)
        return None

    mode = str(raw.get("mode") or "dark").strip().lower()
    if mode not in ("dark", "light"):
        mode = "dark"

    label = _label_from_slug(slug)
    name = _unique_name(slug, taken)

    lighter_bg = normalized.get("lighter_background", background)
    darker_bg = normalized.get("dark_background", background)
    midground_fg = _contrast_for(accent, accent) or "#ffffff"

    colors: dict[str, str] = {
        "background": background,
        "foreground": foreground,
        "card": lighter_bg,
        "cardForeground": foreground,
        "muted": normalized.get("muted", darker_bg),
        "mutedForeground": normalized.get("dark_foreground", foreground),
        "popover": lighter_bg,
        "popoverForeground": foreground,
        "primary": accent,
        "primaryForeground": midground_fg,
        "secondary": lighter_bg,
        "secondaryForeground": foreground,
        "accent": accent,
        "accentForeground": midground_fg,
        "border": darker_bg,
        "input": darker_bg,
        "ring": accent,
        "midground": accent,
        "midgroundForeground": midground_fg,
        "composerRing": accent,
        "destructive": normalized.get("red", accent),
        "destructiveForeground": midground_fg,
        "sidebarBackground": darker_bg,
        "sidebarBorder": darker_bg,
        "userBubble": accent,
        "userBubbleBorder": darker_bg,
    }

    terminal: dict[str, str] = {
        "foreground": foreground,
        "cursor": foreground,
        "selectionBackground": normalized.get("selection", lighter_bg),
        "black": background,
        "red": normalized.get("red", foreground),
        "green": normalized.get("green", foreground),
        "yellow": normalized.get("yellow", foreground),
        "blue": normalized.get("blue", accent),
        "magenta": normalized.get("magenta", accent),
        "cyan": normalized.get("cyan", accent),
        "white": foreground,
        "brightBlack": normalized.get("dark_background", darker_bg),
        "brightRed": normalized.get("bright_red", normalized.get("red", foreground)),
        "brightGreen": normalized.get("bright_green", normalized.get("green", foreground)),
        "brightYellow": normalized.get("bright_yellow", normalized.get("yellow", foreground)),
        "brightBlue": normalized.get("bright_blue", normalized.get("blue", accent)),
        "brightMagenta": normalized.get("bright_magenta", normalized.get("magenta", accent)),
        "brightCyan": normalized.get("bright_cyan", normalized.get("cyan", accent)),
        "brightWhite": normalized.get("bright_foreground", foreground),
    }

    theme: dict[str, Any] = {
        "name": name,
        "label": label,
        "description": f"Omarchy theme · {mode}",
        "colors": colors,
        "terminal": terminal,
    }
    # Omarchy is dark-by-default; ``light`` mode swaps the role of the
    # dark/light palettes so a light theme still paints sensibly.
    if mode == "light":
        theme["darkColors"] = {
            "background": darker_bg,
            "foreground": normalized.get("bright_foreground", foreground),
            "card": background,
            "cardForeground": foreground,
            "muted": lighter_bg,
            "mutedForeground": normalized.get("dark_foreground", foreground),
            "popover": background,
            "popoverForeground": foreground,
            "primary": accent,
            "primaryForeground": midground_fg,
            "secondary": background,
            "secondaryForeground": foreground,
            "accent": accent,
            "accentForeground": midground_fg,
            "border": lighter_bg,
            "input": lighter_bg,
            "ring": accent,
            "midground": accent,
            "midgroundForeground": midground_fg,
            "composerRing": accent,
            "destructive": normalized.get("red", accent),
            "destructiveForeground": midground_fg,
            "sidebarBackground": lighter_bg,
            "sidebarBorder": lighter_bg,
            "userBubble": accent,
            "userBubbleBorder": lighter_bg,
        }
        theme["darkTerminal"] = {
            "foreground": normalized.get("bright_foreground", foreground),
            "cursor": normalized.get("bright_foreground", foreground),
            "selectionBackground": normalized.get("selection", lighter_bg),
            "black": darker_bg,
            "red": normalized.get("bright_red", normalized.get("red", foreground)),
            "green": normalized.get("bright_green", normalized.get("green", foreground)),
            "yellow": normalized.get("bright_yellow", normalized.get("yellow", foreground)),
            "blue": normalized.get("bright_blue", normalized.get("blue", accent)),
            "magenta": normalized.get("bright_magenta", normalized.get("magenta", accent)),
            "cyan": normalized.get("bright_cyan", normalized.get("cyan", accent)),
            "white": normalized.get("bright_foreground", foreground),
            "brightBlack": background,
            "brightRed": normalized.get("red", foreground),
            "brightGreen": normalized.get("green", foreground),
            "brightYellow": normalized.get("yellow", foreground),
            "brightBlue": normalized.get("blue", accent),
            "brightMagenta": normalized.get("magenta", accent),
            "brightCyan": normalized.get("cyan", accent),
            "brightWhite": foreground,
        }

    return ThemeRecord(slug=slug, label=label, mode=mode, theme=theme)


# --- Scanner ---------------------------------------------------------------

def _scan(paths: list[str] | None = None) -> list[ThemeRecord]:
    """Walk the configured paths and return every parseable theme."""
    import tomllib  # local import: 3.11+ stdlib

    roots = paths if paths is not None else _configured_paths()
    taken: set[str] = set()
    out: list[ThemeRecord] = []
    seen_slugs: set[str] = set()

    for raw in roots:
        root = Path(os.path.expanduser(raw))
        if not root.is_dir():
            log.info("omarchy-themes: skip %s (not a directory)", root)
            continue
        for colors in sorted(root.glob("*/colors.toml")):
            slug = colors.parent.name
            if not slug or slug.startswith("."):
                continue
            if slug in seen_slugs:
                # Earlier directory wins so /usr/share/omarchy/themes/catppuccin
                # is preferred over a same-named ~/.config/omarchy/themes overlay.
                continue
            try:
                with colors.open("rb") as fh:
                    parsed = tomllib.load(fh)
            except OSError as exc:
                log.warning("omarchy-themes: cannot read %s: %s", colors, exc)
                continue
            except tomllib.TOMLDecodeError as exc:
                log.warning("omarchy-themes: invalid TOML in %s: %s", colors, exc)
                continue
            if not isinstance(parsed, dict):
                log.warning("omarchy-themes: skip %s (top-level not a table)", colors)
                continue
            record = _build_theme(slug, parsed, taken)
            if record is None:
                continue
            seen_slugs.add(slug)
            taken.add(record.theme["name"])
            out.append(record)

    out.sort(key=lambda r: (r.label.lower(), r.slug))
    return out


def _scan_with_overrides(paths: list[str]) -> list[ThemeRecord]:
    """Scan with explicit paths (used by tests)."""
    return _scan(paths=paths)


# --- FastAPI handlers -------------------------------------------------------

def _to_payload(record: ThemeRecord) -> dict[str, Any]:
    return {"slug": record.slug, "label": record.label, "mode": record.mode, "theme": record.theme}


def _snapshot_or_rescan(force: bool = False) -> tuple[ThemeRecord, ...]:
    cached = None if force else _cache.get(_CACHE_TTL_SECONDS)
    if cached is not None:
        return cached
    fresh = _scan()
    return _cache.publish(fresh)


@router.get("/themes")
def list_themes(paths: str | None = None) -> dict[str, Any]:
    """Return every parsed Omarchy theme.

    Query:
      paths  Comma-separated override of the search roots. Defaults to the
             ``OMARCHY_THEME_PATHS`` env var or the built-in Omarchy paths.
    """
    if paths:
        override = [p.strip() for p in paths.split(",") if p.strip()]
        records = _scan(paths=override)
    else:
        records = _snapshot_or_rescan()
    return {"themes": [_to_payload(r) for r in records], "count": len(records)}


@router.get("/themes/{slug}")
def get_theme(slug: str, paths: str | None = None) -> dict[str, Any]:
    """Return the ``DesktopTheme`` for a single slug; 404 otherwise."""
    if paths:
        records = _scan(paths=[p.strip() for p in paths.split(",") if p.strip()])
    else:
        records = _snapshot_or_rescan()
    for record in records:
        if record.slug == slug:
            return {"slug": record.slug, "label": record.label, "mode": record.mode, "theme": record.theme}
    raise HTTPException(status_code=404, detail=f"theme {slug!r} not found")


@router.post("/rescan")
def rescan(paths: str | None = Query(None, description="Optional comma-separated search paths override.")) -> dict[str, Any]:
    """Invalidate the cache, scan again, and return the new count."""
    _cache.invalidate()
    if paths:
        records = _scan(paths=[p.strip() for p in paths.split(",") if p.strip()])
    else:
        records = _scan()
    _cache.publish(records)
    return {"ok": True, "count": len(records), "themes": [_to_payload(r) for r in records]}


# --- Public helpers (reused by tests) --------------------------------------

__all__ = [
    "router",
    "ThemeRecord",
    "_scan",
    "_scan_with_overrides",
    "_build_theme",
    "_normalize_hex",
    "_label_from_slug",
    "_unique_name",
    "BUILTIN_THEME_NAMES",
]