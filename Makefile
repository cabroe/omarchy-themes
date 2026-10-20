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

.PHONY: help check test lint generate generate-system generate-check install-hook uninstall-hook uninstall install-githooks theme-smoke

help:
	@echo "make check              lint + tests (local, no Omarchy needed)"
	@echo "make generate           regenerate theme table (system themes; HOST=<ssh host> to read remotely; pass --include-user to bake user themes too)"
	@echo "make generate-system    regenerate theme table (system themes only — same as 'generate' since the default already excludes user themes)"
	@echo "make generate-check     fail if plugin.js is out of date (same sources as 'generate')"
	@echo "make install-hook       install hooks/hermes-skin-sync.sh into \$$INSTALL_HOOK_DIR (idempotent)"
	@echo "make uninstall-hook     remove the hook installed by install-hook (alias: make uninstall)"
	@echo "make install-githooks   activate .githooks/ (pre-push generate-check) for this clone"
	@echo "make theme-smoke        run end-to-end theme-switch test over SSH (HOST=<ssh host>, default 'omarchy')"

check: lint test

lint:
	node --check desktop/plugin.js tests/palette-parity.mjs
	python3 -m py_compile scripts/generate-themes.py __init__.py
	shellcheck hooks/hermes-skin-sync.sh tests/hook.sh tests/theme-switch-smoke.sh tests/palette-parity.sh .githooks/pre-push

test:
	node --enable-source-maps tests/smoke.mjs
	sh tests/hook.sh
	sh tests/palette-parity.sh

generate:
	python3 scripts/generate-themes.py $(GEN_ARGS)

# generate-system: alias for `generate`. Kept for backward compatibility with
# the regen-themes CI workflow (the runner's ~/.config/omarchy/themes are no
# longer published automatically because the default `generate` already
# excludes user themes).
generate-system: generate

generate-check:
	python3 scripts/generate-themes.py $(GEN_ARGS) --check

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
