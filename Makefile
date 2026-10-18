# HOST is optional. Unset: the generator reads this machine's Omarchy themes
# (the normal case on the Omarchy laptop). Set (HOST=omarchy): read them over SSH.
HOST ?=
GEN_ARGS = --include-user $(if $(HOST),--remote $(HOST))

INSTALL_HOOK_DIR ?= $(HOME)/.config/omarchy/hooks/theme-set.d
INSTALL_HOOK     ?= $(INSTALL_HOOK_DIR)/hermes-skin-sync.sh

.PHONY: help check test lint generate generate-system generate-check install-hook uninstall install-githooks theme-smoke

help:
	@echo "make check              lint + tests (local, no Omarchy needed)"
	@echo "make generate           regenerate theme table (system + user themes; HOST=<ssh host> to read remotely)"
	@echo "make generate-system    regenerate theme table (system themes only — used by CI to avoid publishing user themes)"
	@echo "make generate-check     fail if plugin.js is out of date (same sources as 'generate')"
	@echo "make install-hook       install hooks/hermes-skin-sync.sh into \$$INSTALL_HOOK_DIR (idempotent)"
	@echo "make uninstall          remove the hook installed by install-hook"
	@echo "make install-githooks   activate .githooks/ (pre-push generate-check) for this clone"
	@echo "make theme-smoke        run end-to-end theme-switch test over SSH (HOST=<ssh host>, default 'omarchy')"

check: lint test

lint:
	node --check desktop/plugin.js
	python3 -m py_compile scripts/generate-themes.py __init__.py
	shellcheck hooks/hermes-skin-sync.sh tests/hook.sh tests/theme-switch-smoke.sh .githooks/pre-push

test:
	node tests/smoke.mjs
	sh tests/hook.sh

generate:
	python3 scripts/generate-themes.py $(GEN_ARGS)

# generate-system: same as generate but without --include-user.
# Used by the regen-themes CI workflow so the self-hosted runner's personal
# ~/.config/omarchy/themes are never published to main automatically.
generate-system:
	python3 scripts/generate-themes.py $(if $(HOST),--remote $(HOST))

generate-check:
	python3 scripts/generate-themes.py $(GEN_ARGS) --check

install-hook:
	mkdir -p $(INSTALL_HOOK_DIR)
	install -m 755 hooks/hermes-skin-sync.sh $(INSTALL_HOOK)

uninstall:
	rm -f $(INSTALL_HOOK)

install-githooks:
	git config core.hooksPath .githooks
	@echo "pre-push hook active — runs 'make generate-check' before every push (local Omarchy themes, or over SSH when HOST is set; skipped if neither is available)."

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
