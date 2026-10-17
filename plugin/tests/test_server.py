"""FastAPI route test for the omarchy-themes backend.

Boots the router through ``fastapi.testclient.TestClient`` against the
fixture themes, asserts the endpoint shape and the named colors. Exits 0
on success.

Invoke directly:

    python3 tests/test_server.py
"""

from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PLUGIN_ROOT = HERE.parent
sys.path.insert(0, str(PLUGIN_ROOT / "dashboard"))

import plugin_api  # type: ignore  # noqa: E402

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

# Wipe the in-memory cache before each test run so a previous run that
# scanned OMARCHY_THEME_PATHS doesn't bleed into this isolated fixture set.
plugin_api._cache.invalidate()

FIXTURE_THEMES = str((HERE / "fixtures" / "themes").resolve())

app = FastAPI()
app.include_router(plugin_api.router, prefix="/api/plugins/omarchy-themes")
client = TestClient(app)


def test_list_themes() -> None:
    resp = client.get("/api/plugins/omarchy-themes/themes", params={"paths": FIXTURE_THEMES})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body, dict)
    slugs = sorted(t["slug"] for t in body["themes"])
    # "empty" has no usable colors and is skipped — only two themes remain.
    assert slugs == ["catppuccin", "gruvbox"], slugs
    assert body["count"] == 2

    by_slug = {t["slug"]: t for t in body["themes"]}
    catppuccin = by_slug["catppuccin"]
    assert catppuccin["label"] == "Catppuccin"
    assert catppuccin["mode"] == "dark"
    assert catppuccin["theme"]["name"] == "catppuccin-omarchy"
    assert catppuccin["theme"]["colors"]["background"] == "#1e1e2e"
    assert catppuccin["theme"]["colors"]["primary"] == "#89b4fa"
    assert catppuccin["theme"]["terminal"]["red"] == "#f38ba8"

    gruvbox = by_slug["gruvbox"]
    assert gruvbox["theme"]["colors"]["background"] == "#282828"
    assert gruvbox["theme"]["colors"]["primary"] == "#fabd2f"
    assert gruvbox["theme"]["terminal"]["green"] == "#b8bb26"
    # gruvbox is not a built-in, so its name stays bare.
    assert gruvbox["theme"]["name"] == "gruvbox", gruvbox["theme"]["name"]


def test_get_theme_by_slug() -> None:
    resp = client.get(
        "/api/plugins/omarchy-themes/themes/catppuccin", params={"paths": FIXTURE_THEMES}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["slug"] == "catppuccin"
    assert body["theme"]["name"] == "catppuccin-omarchy"
    assert body["theme"]["colors"]["background"] == "#1e1e2e"


def test_get_unknown_theme_404() -> None:
    resp = client.get(
        "/api/plugins/omarchy-themes/themes/does-not-exist",
        params={"paths": FIXTURE_THEMES},
    )
    assert resp.status_code == 404, resp.status_code


def test_rescan_returns_count() -> None:
    resp = client.post(
        "/api/plugins/omarchy-themes/rescan", params={"paths": FIXTURE_THEMES}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    assert body["count"] == 2
    assert isinstance(body["themes"], list) and len(body["themes"]) == 2


def test_is_valid_theme_shape() -> None:
    """The deserialized theme must satisfy isValidTheme()'s required-key bar."""
    # Reuse the SDK's contract: background, foreground, primary are strings.
    for entry in client.get(
        "/api/plugins/omarchy-themes/themes", params={"paths": FIXTURE_THEMES}
    ).json()["themes"]:
        colors = entry["theme"]["colors"]
        for required in ("background", "foreground", "primary"):
            assert isinstance(colors[required], str), (entry["slug"], required, colors[required])
            assert colors[required].startswith("#") and len(colors[required]) == 7, (entry["slug"], colors[required])


def main() -> int:
    failures: list[str] = []
    for fn in (
        test_list_themes,
        test_get_theme_by_slug,
        test_get_unknown_theme_404,
        test_rescan_returns_count,
        test_is_valid_theme_shape,
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
    print(
        "OK  "
        f"{len([test_list_themes, test_get_theme_by_slug, test_get_unknown_theme_404, test_rescan_returns_count, test_is_valid_theme_shape])}"
        " server tests passed"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())