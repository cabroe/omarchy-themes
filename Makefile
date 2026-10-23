# HOST is optional. Unset: the generator reads this machine's Omarchy themes
# (the normal case on the Omarchy laptop). Set (HOST=omarchy): read them over SSH.
# The default excludes user themes — the baked table in main holds system themes
# only, so the pre-push check matches the committed state. Pass `make generate
# --include-user` (or `make generate SYSTEM=…` with explicit override) to bake
# user themes locally. User themes are read live from current/theme/colors.toml
# via `omarchy-current` regardless.
HOST ?=
GEN_ARGS = $(if $(HOST),--remote $(HOST))

INSTALL_HOOK_DIR ?= $(HOME)/.config/omarchy/hooks/theme-set.d
INSTALL_HOOK     ?= $(INSTALL_HOOK_DIR)/hermes-skin-sync.sh

.PHONY: help check test lint pages-check generate generate-system generate-check install-hook uninstall-hook uninstall install-githooks theme-smoke

help:
	@echo "make check              lint + tests + pages-check (local, no Omarchy needed)"
	@echo "make pages-check        gh-pages drift gate (PAGES_DIR=<checkout>; skips visibly without one)"
	@echo "                        (make reports every failing recipe as its own exit 2 — the gate's real code is printed as 'gate exit code: N')"
	@echo "make generate           regenerate theme table (system themes; HOST=<ssh host> to read remotely; pass --include-user to bake user themes too)"
	@echo "make generate-system    regenerate theme table (system themes only — same as 'generate' since the default already excludes user themes)"
	@echo "make generate-check     fail if plugin.js is out of date (same sources as 'generate')"
	@echo "make install-hook       install hooks/hermes-skin-sync.sh into \$$INSTALL_HOOK_DIR (idempotent)"
	@echo "make uninstall-hook     remove the hook installed by install-hook (alias: make uninstall)"
	@echo "make install-githooks   activate .githooks/ (pre-push generate-check) for this clone"
	@echo "make theme-smoke        run end-to-end theme-switch test over SSH (HOST=<ssh host>, default 'omarchy')"

# `check` = lint + test + pages-check. Das Drift-Gate haengt von einem
# *optionalen* gh-pages-Checkout ab und gehoert deshalb nicht in `test` (das
# bleibt die host-freie, deterministische Suite): beide Targets laufen hier
# zusammen, und pages-check ueberspringt ohne Checkout sichtbar mit Exit 0.
check: lint test pages-check

lint:
	node --check desktop/plugin.js tests/palette-parity.mjs
	python3 -m py_compile scripts/generate-themes.py scripts/embed-hook.py scripts/check-pages-consistency.py __init__.py
	shellcheck hooks/hermes-skin-sync.sh tests/hook.sh tests/theme-switch-smoke.sh tests/palette-parity.sh tests/pages-gate.sh tests/pages-check-enforcement.sh .githooks/pre-push

test:
	node --enable-source-maps tests/smoke.mjs
	sh tests/hook.sh
	sh tests/palette-parity.sh
	sh tests/pages-gate.sh
	sh tests/pages-check-enforcement.sh
	python3 scripts/embed-hook.py --check

# Drift-Gate zwischen main (desktop/plugin.js, hooks/) und dem deployten
# gh-pages-Branch. Checkout-Aufloesung: PAGES_DIR-Env -> ./pages -> keiner.
# Ohne aufloesbaren Checkout laeuft das Gate nicht — das bleibt Exit 0, damit
# `make check` auf jedem Host ohne gh-pages-Klon gruen ist, wird aber laut gesagt:
# `⚠ SKIP — PAGES DRIFT GATE DID NOT RUN` plus Verweis auf die CI-Erzwingung und
# auf `PAGES_STRICT=1`, das einen fehlenden Checkout zum harten Fehler (Exit 2)
# macht. Kalibriert in `make test` (tests/pages-check-enforcement.sh), weil eine
# blosse "SKIP"-Zeile in einem Abnahmelog nicht von "Gate gelaufen" zu
# unterscheiden war (QA-Befund t_1048777b).
# Erzwungen wird das Gate in CI
# (.github/workflows/pages-consistency.yml), das das Script direkt aufruft — dort
# ist ein fehlender Checkout ein harter Fehler (Exit 2), kein Skip.
#
# Exit-Code-Semantik des Gates: 0 = in sync, 1 = Drift, 2 = Parse/IO.
# `make` kann diese Codes NICHT durchreichen: jeder fehlgeschlagene Recipe
# endet mit make-eigenem Status 2 — also derselben Zahl wie der Parse-Fehler
# des Gates. Deshalb faengt die Recipe den Code ab, druckt ihn sichtbar als
# `gate exit code: N` und beendet sich damit (make meldet dann weiterhin 2).
# Die Kalibrierung der Codes selbst laeuft host-frei in `make test`
# (tests/pages-gate.sh, synthetisches Fixture).
pages-check:
	@dir='$(PAGES_DIR)'; strict='$(PAGES_STRICT)'; [ -n "$$strict" ] || strict="$${PAGES_STRICT:-}"; \
	if [ -z "$$dir" ] && [ -d pages ]; then dir='./pages'; fi; \
	if [ -z "$$dir" ]; then \
	  if [ -n "$$strict" ]; then \
	    echo "FAIL: no gh-pages checkout (PAGES_DIR unset, ./pages missing) and PAGES_STRICT is set — pages drift gate cannot run" >&2; \
	    exit 2; \
	  fi; \
	  echo "⚠ SKIP — PAGES DRIFT GATE DID NOT RUN: no gh-pages checkout (PAGES_DIR unset, ./pages missing)."; \
	  echo "  This run did NOT check main against the deployed pages. Enforced in CI:"; \
	  echo "  .github/workflows/pages-consistency.yml (missing checkout there is a hard failure, exit 2)."; \
	  echo "  For a hard failure locally: make pages-check PAGES_STRICT=1"; \
	  exit 0; \
	fi; \
	if [ ! -d "$$dir" ]; then \
	  if [ -n "$$strict" ]; then \
	    echo "FAIL: PAGES_DIR=$$dir does not exist and PAGES_STRICT is set — pages drift gate cannot run" >&2; \
	    exit 2; \
	  fi; \
	  echo "⚠ SKIP — PAGES DRIFT GATE DID NOT RUN: PAGES_DIR=$$dir does not exist."; \
	  echo "  This run did NOT check main against the deployed pages. Enforced in CI:"; \
	  echo "  .github/workflows/pages-consistency.yml (missing checkout there is a hard failure, exit 2)."; \
	  echo "  For a hard failure locally: make pages-check PAGES_STRICT=1"; \
	  exit 0; \
	fi; \
	status=0; \
	python3 scripts/check-pages-consistency.py --pages "$$dir" --root . || status=$$?; \
	echo "gate exit code: $$status (0 = in sync, 1 = drift, 2 = parse/IO)"; \
	exit $$status

generate:
	python3 scripts/generate-themes.py $(GEN_ARGS)
	python3 scripts/embed-hook.py

# generate-system: alias for `generate`. Kept for backward compatibility with
# the regen-themes CI workflow (the runner's ~/.config/omarchy/themes are no
# longer published automatically because the default `generate` already
# excludes user themes).
generate-system: generate

generate-check:
	python3 scripts/generate-themes.py $(GEN_ARGS) --check
	python3 scripts/embed-hook.py --check

install-hook:
	mkdir -p $(INSTALL_HOOK_DIR)
	install -m 755 hooks/hermes-skin-sync.sh $(INSTALL_HOOK)

uninstall-hook uninstall:
	rm -f $(INSTALL_HOOK)

install-githooks:
	git config core.hooksPath .githooks
	@echo "pre-push hook active — runs 'make generate-check' before every push; blocks on drift, skipped if no Omarchy themes are reachable."

# Live end-to-end test of the Omarchy hook chain: SSH into the host, run
# tests/theme-switch-smoke.sh against the real Omarchy hook chain. It checks the
# CLI/TUI skin pipeline only, not the desktop plugin. NOT part of `make check`
# because that has to stay host-free. Pass THEMES="..." to override the default
# cross-section baked into the test script (mix of system+user, light+dark).
THEME_SMOKE_HOST = $(or $(HOST),omarchy)
theme-smoke:
	@command -v ssh >/dev/null || { echo "ssh not found"; exit 1; }
	scp tests/theme-switch-smoke.sh $(THEME_SMOKE_HOST):/tmp/theme-switch-smoke.sh
	ssh $(THEME_SMOKE_HOST) 'bash /tmp/theme-switch-smoke.sh $(THEMES)'
