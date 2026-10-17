"""Standalone parser test for the omarchy-themes color mapping.

Runs the mapping function against the fixtures under ``tests/fixtures/themes``
without booting FastAPI. Exits 0 on success, 1 on failure.

Invoke directly:

    python3 tests/test_parser.py
"""

from __future__ import annotations

import sys
import tomllib
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures" / "themes"
PLUGIN_ROOT = HERE.parent
sys.path.insert(0, str(PLUGIN_ROOT / "dashboard"))

import plugin_api  # type: ignore  # noqa: E402


def _load(name: str) -> dict:
    with (FIXTURES / name / "colors.toml").open("rb") as fh:
        return tomllib.load(fh)


def _build(slug: str) -> plugin_api.ThemeRecord:
    parsed = _load(slug)
    record = plugin_api._build_theme(slug, parsed, set())
    if record is None:
        raise AssertionError(f"_build_theme({slug!r}) returned None")
    return record


def test_catppuccin_mapping() -> None:
    record = _build("catppuccin")
    colors = record.theme["colors"]
    term = record.theme["terminal"]
    # Spec acceptance criteria for catppuccin:
    assert colors["background"] == "#1e1e2e", colors["background"]
    assert colors["primary"] == "#89b4fa", colors["primary"]
    assert term["red"] == "#f38ba8", term["red"]
    # Built-in collision must be suffixed.
    assert record.theme["name"] == "catppuccin-omarchy", record.theme["name"]
    # Mode + label.
    assert record.mode == "dark"
    assert record.label == "Catppuccin"


def test_gruvbox_mapping() -> None:
    record = _build("gruvbox")
    colors = record.theme["colors"]
    term = record.theme["terminal"]
    assert colors["background"] == "#282828", colors["background"]
    assert colors["primary"] == "#fabd2f", colors["primary"]
    assert term["green"] == "#b8bb26", term["green"]
    # gruvbox is NOT in the built-in collision set, so the name stays bare.
    assert record.theme["name"] == "gruvbox", record.theme["name"]
    assert record.label == "Gruvbox"


def test_label_slug_rules() -> None:
    # Word boundary on `-` and `_`, every chunk title-cased, case-folded
    # mid-word ("Catppuccin-Latte" → "Catppuccin Latte", not "Latte").
    assert plugin_api._label_from_slug("catppuccin") == "Catppuccin"
    assert plugin_api._label_from_slug("catppuccin-latte") == "Catppuccin Latte"
    assert plugin_api._label_from_slug("tokyo-night") == "Tokyo Night"
    assert plugin_api._label_from_slug("solarized_light") == "Solarized Light"


def test_normalize_hex() -> None:
    assert plugin_api._normalize_hex("#fff") == "#ffffff"
    assert plugin_api._normalize_hex("fff") == "#ffffff"
    assert plugin_api._normalize_hex("#ABCDEF") == "#abcdef"
    assert plugin_api._normalize_hex("ABCDEF") == "#abcdef"
    assert plugin_api._normalize_hex("#112233") == "#112233"
    # Garbage
    assert plugin_api._normalize_hex("not-a-color") is None
    assert plugin_api._normalize_hex("#zzz") is None
    assert plugin_api._normalize_hex("") is None
    assert plugin_api._normalize_hex(None) is None


def test_unique_name_collision() -> None:
    # First pick gets the bare slug, subsequent ones pick up the suffix.
    taken = set()
    assert plugin_api._unique_name("catppuccin", taken) == "catppuccin-omarchy"
    taken.add("catppuccin-omarchy")
    assert plugin_api._unique_name("catppuccin", taken) == "catppuccin-omarchy-dup"


def test_empty_colors_toml_is_skipped() -> None:
    parsed = _load("empty")
    assert parsed == {}, f"empty fixture parsed to {parsed!r}"
    record = plugin_api._build_theme("empty", parsed, set())
    assert record is None, f"empty colors.toml must yield None, got {record!r}"


def main() -> int:
    failures: list[str] = []
    for fn in (
        test_catppuccin_mapping,
        test_gruvbox_mapping,
        test_label_slug_rules,
        test_normalize_hex,
        test_unique_name_collision,
        test_empty_colors_toml_is_skipped,
    ):
        try:
            fn()
        except AssertionError as exc:
            failures.append(f"{fn.__name__}: AssertionError: {exc}")
        except Exception as exc:
            failures.append(f"{fn.__name__}: {type(exc).__name__}: {exc}")
    if failures:
        for line in failures:
            print(f"FAIL {line}", file=sys.stderr)
        return 1
    print(f"OK  {len([test_catppuccin_mapping, test_gruvbox_mapping, test_label_slug_rules, test_normalize_hex, test_unique_name_collision, test_empty_colors_toml_is_skipped])} parser tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())