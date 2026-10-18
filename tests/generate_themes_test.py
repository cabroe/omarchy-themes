"""Unit tests for scripts/generate-themes.py.

Stdlib-only (unittest). Run from the repo root:

    python3 -m unittest tests/generate_themes_test.py

The script exposes SYSTEM_DIR / USER_DIR as module-level constants (no CLI
flag to point them elsewhere) and reads them inside main(), so the exit-code
tests patch them onto a TemporaryDirectory. The script's own subprocess calls
in local mode are bash invocations that exit 0 harmlessly against an empty
or theme-only temp dir (no alacritty.toml present), so no further mocking
is required.
"""
from __future__ import annotations

import contextlib
import importlib.util
import io
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parent.parent
_SCRIPT = REPO / "scripts" / "generate-themes.py"

# The script's filename contains a hyphen, which is not a valid Python module
# name, so a normal `import` cannot find it. Load it by file path under a
# synthetic module name instead.
_spec = importlib.util.spec_from_file_location("_generate_themes_under_test", _SCRIPT)
generate_themes = importlib.util.module_from_spec(_spec)  # type: ignore[assignment]
sys.modules[_spec.name] = generate_themes
_spec.loader.exec_module(generate_themes)


# A complete, valid colors.toml body: required keys + required ANSI in 6-digit hex.
VALID_TOML = textwrap.dedent("""\
    background = "#2e3440"
    foreground = "#d8dee9"
    accent    = "#81a1c1"
    red       = "#bf616a"
    yellow    = "#ebcb8b"
    green     = "#a3be8c"
    cyan      = "#88c0d0"
    blue      = "#81a1c1"
    magenta   = "#b48ead"
""").lstrip()


def _quiet(func, *args, **kwargs):
    """Run a function while suppressing the stderr noise generate_themes prints."""
    with contextlib.redirect_stderr(io.StringIO()):
        return func(*args, **kwargs)


class NormHexTests(unittest.TestCase):
    def test_three_digit_expansion(self):
        # #abc → #aabbcc (each digit doubled in place).
        self.assertEqual(generate_themes.norm_hex("#abc"), "#aabbcc")
        self.assertEqual(generate_themes.norm_hex("#8cf"), "#88ccff")

    def test_six_digit_lowercased(self):
        self.assertEqual(generate_themes.norm_hex("#AABBCC"), "#aabbcc")
        self.assertEqual(generate_themes.norm_hex("#AaBbCc"), "#aabbcc")

    def test_works_without_hash_prefix(self):
        self.assertEqual(generate_themes.norm_hex("aabbcc"), "#aabbcc")

    def test_invalid_returns_none(self):
        self.assertIsNone(generate_themes.norm_hex(""))
        self.assertIsNone(generate_themes.norm_hex("#xyz"))
        self.assertIsNone(generate_themes.norm_hex("#1234"))      # 4 digits — no match
        self.assertIsNone(generate_themes.norm_hex("#1234567"))   # 7 digits — no match
        self.assertIsNone(generate_themes.norm_hex("#gg"))        # non-hex


class ParsePaletteTests(unittest.TestCase):
    def test_valid_full_palette(self):
        result = _quiet(generate_themes.parse_palette, "nord", VALID_TOML)
        self.assertIsNotNone(result)
        self.assertEqual(result["background"], "#2e3440")
        self.assertEqual(result["foreground"], "#d8dee9")
        self.assertEqual(result["accent"], "#81a1c1")
        self.assertEqual(result["red"], "#bf616a")
        # required ANSI keys present
        for key in ("red", "yellow", "green", "cyan", "blue", "magenta"):
            self.assertIn(key, result)

    def test_corrupt_toml_returns_none(self):
        result = _quiet(generate_themes.parse_palette, "bad", "this is not = valid [toml")
        self.assertIsNone(result)

    def test_missing_background_returns_none(self):
        text = textwrap.dedent("""\
            foreground = "#d8dee9"
            accent    = "#81a1c1"
            red       = "#bf616a"
            yellow    = "#ebcb8b"
            green     = "#a3be8c"
            cyan      = "#88c0d0"
            blue      = "#81a1c1"
            magenta   = "#b48ead"
        """)
        self.assertIsNone(_quiet(generate_themes.parse_palette, "x", text))

    def test_required_ansi_missing_returns_none(self):
        # yellow intentionally absent.
        text = textwrap.dedent("""\
            background = "#2e3440"
            foreground = "#d8dee9"
            accent    = "#81a1c1"
            red       = "#bf616a"
            green     = "#a3be8c"
            cyan      = "#88c0d0"
            blue      = "#81a1c1"
            magenta   = "#b48ead"
        """)
        self.assertIsNone(_quiet(generate_themes.parse_palette, "x", text))

    def test_three_digit_hex_expanded(self):
        text = textwrap.dedent("""\
            background = "#abc"
            foreground = "#d8dee9"
            accent    = "#81a1c1"
            red       = "#bf616a"
            yellow    = "#ebcb8b"
            green     = "#a3be8c"
            cyan      = "#88c0d0"
            blue      = "#81a1c1"
            magenta   = "#b48ead"
        """)
        result = _quiet(generate_themes.parse_palette, "x", text)
        self.assertIsNotNone(result)
        self.assertEqual(result["background"], "#aabbcc")

    def test_six_digit_hex_lowercased(self):
        text = textwrap.dedent("""\
            background = "#AABBCC"
            foreground = "#d8dee9"
            accent    = "#81a1c1"
            red       = "#bf616a"
            yellow    = "#ebcb8b"
            green     = "#a3be8c"
            cyan      = "#88c0d0"
            blue      = "#81a1c1"
            magenta   = "#b48ead"
        """)
        result = _quiet(generate_themes.parse_palette, "x", text)
        self.assertIsNotNone(result)
        self.assertEqual(result["background"], "#aabbcc")

    def test_mode_light_string(self):
        text = 'mode = "light"\n' + VALID_TOML
        result = _quiet(generate_themes.parse_palette, "x", text)
        self.assertEqual(result["mode"], "light")

    def test_mode_dark_string(self):
        text = 'mode = "dark"\n' + VALID_TOML
        result = _quiet(generate_themes.parse_palette, "x", text)
        self.assertEqual(result["mode"], "dark")

    def test_mode_light_case_insensitive(self):
        text = 'mode = "LIGHT"\n' + VALID_TOML
        result = _quiet(generate_themes.parse_palette, "x", text)
        self.assertEqual(result["mode"], "light")

    def test_mode_any_non_light_becomes_dark(self):
        # e.g. "auto" — the script treats anything that isn't "light" as "dark".
        text = 'mode = "auto"\n' + VALID_TOML
        result = _quiet(generate_themes.parse_palette, "x", text)
        self.assertEqual(result["mode"], "dark")

    def test_mode_missing_defaults_to_dark(self):
        # The actual script behaviour: no mode key → "dark".
        # (Background-luma inference lives in the hook, not here.)
        result = _quiet(generate_themes.parse_palette, "x", VALID_TOML)
        self.assertEqual(result["mode"], "dark")

    def test_extra_keys_ignored(self):
        # KEYS is the allowlist; anything outside it (like a stray "extra") must not appear.
        text = 'extra = "#112233"\n' + VALID_TOML
        result = _quiet(generate_themes.parse_palette, "x", text)
        self.assertIsNotNone(result)
        self.assertNotIn("extra", result)


class ReadLocalTests(unittest.TestCase):
    def test_reads_each_slug(self):
        with tempfile.TemporaryDirectory() as tmp:
            for slug in ("alpha", "bravo"):
                d = Path(tmp) / slug
                d.mkdir()
                (d / "colors.toml").write_text(VALID_TOML)
            result = generate_themes.read_local(tmp)
        self.assertEqual(set(result.keys()), {"alpha", "bravo"})
        self.assertIn("background", result["alpha"])

    def test_missing_dir_returns_empty(self):
        self.assertEqual(generate_themes.read_local("/nonexistent/path/xyz"), {})

    def test_slugs_are_sorted(self):
        # Implementation does sorted(root.glob("*/colors.toml")).
        with tempfile.TemporaryDirectory() as tmp:
            for slug in ("zeta", "alpha", "mike"):
                d = Path(tmp) / slug
                d.mkdir()
                (d / "colors.toml").write_text(VALID_TOML)
            result = generate_themes.read_local(tmp)
        self.assertEqual(list(result.keys()), ["alpha", "mike", "zeta"])


class ParseSectionsTests(unittest.TestCase):
    def test_single_section(self):
        result = generate_themes.parse_sections("@@@ nord\nbackground = \"#2e3440\"\n")
        self.assertEqual(set(result.keys()), {"nord"})
        self.assertIn("background", result["nord"])

    def test_multiple_sections(self):
        text = "@@@ a\nbody a line 1\n\n@@@ b\nbody b line 1\n"
        result = generate_themes.parse_sections(text)
        self.assertEqual(set(result.keys()), {"a", "b"})
        self.assertEqual(result["a"], "body a line 1\n\n")
        self.assertEqual(result["b"], "body b line 1\n")

    def test_empty_stdout(self):
        self.assertEqual(generate_themes.parse_sections(""), {})


class RenderTests(unittest.TestCase):
    def test_render_emits_begin_and_end_markers(self):
        rendered = generate_themes.render({"nord": _quiet(generate_themes.parse_palette, "nord", VALID_TOML)}, ["/some/dir"])
        self.assertIn(generate_themes.BEGIN, rendered)
        self.assertIn(generate_themes.END, rendered)
        self.assertIn("'nord'", rendered)
        self.assertIn("RAW", rendered)


class MainExitCodesTests(unittest.TestCase):
    """End-to-end tests of main()'s exit codes via tempdir fixtures."""

    PLUGIN_HEADER = "// header line\n"
    PLUGIN_FOOTER = "// trailer line\n"
    # BEGIN / END markers — these MUST exist in the plugin for main() to proceed.
    PLUGIN_TEMPLATE = "// header line\n{begin}\n{body}\n{end}\n// trailer line\n"
    BEGIN = generate_themes.BEGIN
    END = generate_themes.END

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self._system = root / "system"
        self._user = root / "user"
        self._system.mkdir()
        self._user.mkdir()
        self._plugin_path = root / "plugin.js"
        self._patches = [
            mock.patch.object(generate_themes, "SYSTEM_DIR", str(self._system)),
            mock.patch.object(generate_themes, "USER_DIR", str(self._user)),
        ]
        for p in self._patches:
            p.start()

    def tearDown(self):
        for p in self._patches:
            p.stop()
        self._tmp.cleanup()

    def _write_theme(self, base, slug, toml=VALID_TOML):
        d = base / slug
        d.mkdir(exist_ok=True)
        (d / "colors.toml").write_text(toml)

    def _write_plugin(self, body):
        self._plugin_path.write_text(
            self.PLUGIN_TEMPLATE.format(begin=self.BEGIN, body=body, end=self.END)
        )

    def _run_main(self, *extra_args):
        # main() reads sys.argv via argparse — patch it instead of calling with
        # positional args (main() takes none).
        with mock.patch.object(sys, "argv", ["generate-themes", "--plugin", str(self._plugin_path), *extra_args]):
            return _quiet(generate_themes.main)

    def test_exit_zero_when_up_to_date(self):
        # The script only rewrites the marked region of an existing file; the
        # first run therefore needs a seed plugin with valid markers, after
        # which a re-run reports up-to-date.
        self._write_plugin("// initial seed body")
        self._write_theme(self._system, "nord")
        rc = self._run_main()
        self.assertEqual(rc, 0, "first run should rewrite the marked block and return 0")

        # Second run: same plugin, same themes → up-to-date → 0.
        rc2 = self._run_main()
        self.assertEqual(rc2, 0, "unchanged plugin should report up-to-date")

    def test_exit_one_on_drift_with_check(self):
        # Seed plugin.js with a stale body that does NOT match what main() would render.
        self._write_plugin("// stale block that won't match")
        # Themes now generate a different block — --check should detect the drift.
        self._write_theme(self._system, "nord")
        rc = self._run_main("--check")
        self.assertEqual(rc, 1, "--check should exit 1 when plugin.js is out of date")
        # --check must NOT have written to the file.
        self.assertIn("stale block that won't match", self._plugin_path.read_text())

    def test_exit_two_when_markers_missing(self):
        # Plugin without the BEGIN/END markers → main() refuses → 2.
        self._plugin_path.write_text("// no markers here at all\n")
        self._write_theme(self._system, "nord")
        rc = self._run_main()
        self.assertEqual(rc, 2, "missing markers should exit 2")

    def test_exit_two_when_no_usable_themes(self):
        # Markers present, but the theme dirs are empty (or all invalid).
        self._write_plugin("// some body\n")
        # write a theme with a missing required key → parse_palette returns None
        self._write_theme(self._system, "broken", textwrap.dedent("""\
            foreground = "#d8dee9"
            accent    = "#81a1c1"
        """))
        rc = self._run_main()
        self.assertEqual(rc, 2, "no usable themes should exit 2")


class UserOverrideTests(unittest.TestCase):
    """User theme must override system theme on slug collision."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self._system = root / "system"
        self._user = root / "user"
        self._system.mkdir()
        self._user.mkdir()
        self._plugin_path = root / "plugin.js"
        self._patches = [
            mock.patch.object(generate_themes, "SYSTEM_DIR", str(self._system)),
            mock.patch.object(generate_themes, "USER_DIR", str(self._user)),
        ]
        for p in self._patches:
            p.start()

    def tearDown(self):
        for p in self._patches:
            p.stop()
        self._tmp.cleanup()

    def test_user_theme_wins_on_slug_collision(self):
        # Same slug "x" in both dirs; user has different background.
        system_toml = VALID_TOML.replace("#2e3440", "#000000")
        user_toml = VALID_TOML.replace("#2e3440", "#ffffff")

        (self._system / "x").mkdir()
        (self._system / "x" / "colors.toml").write_text(system_toml)
        (self._user / "x").mkdir()
        (self._user / "x" / "colors.toml").write_text(user_toml)

        plugin_text = "// header\n{begin}\n{body}\n{end}\n// trailer\n".format(
            begin=generate_themes.BEGIN, body="placeholder", end=generate_themes.END
        )
        self._plugin_path.write_text(plugin_text)

        with mock.patch.object(sys, "argv", ["generate-themes", "--plugin", str(self._plugin_path), "--include-user"]):
            rc = _quiet(generate_themes.main)
        self.assertEqual(rc, 0)

        rendered = self._plugin_path.read_text()
        # Find the line for slug 'x' and verify its background is the user's value.
        x_line = next(line for line in rendered.splitlines() if "slug:'x'" in line)
        self.assertIn("background:'#ffffff'", x_line)
        self.assertNotIn("#000000", x_line)


if __name__ == "__main__":
    unittest.main()