HOST ?= omarchy

INSTALL_HOOK_DIR ?= $(HOME)/.config/omarchy/hooks/theme-set.d
INSTALL_HOOK     ?= $(INSTALL_HOOK_DIR)/hermes-skin-sync.sh

.PHONY: help check test lint generate generate-check install-hook uninstall install-githooks theme-smoke

help:
	@echo "make check              lint + tests (local, no host needed)"
	@echo "make generate           regenerate theme table from \$$HOST (incl. user themes)"
	@echo "make generate-check     fail if plugin.js is out of date vs. \$$HOST (incl. user themes)"
	@echo "make install-hook       install hooks/hermes-skin-sync.sh into \$$INSTALL_HOOK_DIR (idempotent)"
	@echo "make uninstall          remove the hook installed by install-hook"
	@echo "make install-githooks   activate .githooks/ (pre-push generate-check) for this clone"
	@echo "make theme-smoke        run end-to-end theme-switch test on \$$HOST (SSH, defaults from tests/theme-switch-smoke.sh)"

check: lint test

lint:
	node --check desktop/plugin.js
	python3 -m py_compile scripts/generate-themes.py __init__.py
	shellcheck hooks/hermes-skin-sync.sh tests/hook.sh tests/theme-switch-smoke.sh .githooks/pre-push

test:
	node tests/smoke.mjs
	sh tests/hook.sh

generate:
	python3 scripts/generate-themes.py --remote $(HOST) --include-user

generate-check:
	python3 scripts/generate-themes.py --remote $(HOST) --include-user --check

install-hook:
	mkdir -p $(INSTALL_HOOK_DIR)
	install -m 755 hooks/hermes-skin-sync.sh $(INSTALL_HOOK)

uninstall:
	rm -f $(INSTALL_HOOK)

install-githooks:
	git config core.hooksPath .githooks
	@echo "pre-push hook active — runs 'make generate-check HOST=\$$HOST' before every push (skips if host unreachable)."

# Live end-to-end test: SSH into $(HOST), run tests/theme-switch-smoke.sh
# against the real Omarchy hook chain. NOT part of `make check` because
# that has to stay host-free. Pass THEMES="..." to override the default
# cross-section baked into the test script (mix of system+user, light+dark).
theme-smoke:
	@command -v ssh >/dev/null || { echo "ssh not found"; exit 1; }
	scp tests/theme-switch-smoke.sh $(HOST):/tmp/theme-switch-smoke.sh
	ssh $(HOST) 'bash /tmp/theme-switch-smoke.sh $(THEMES)'
