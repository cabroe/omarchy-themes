HOST ?= omarchy

INSTALL_HOOK_DIR ?= $(HOME)/.config/omarchy/hooks/theme-set.d
INSTALL_HOOK     ?= $(INSTALL_HOOK_DIR)/hermes-skin-sync.sh

.PHONY: help check test lint generate generate-check install-hook uninstall install-githooks

help:
	@echo "make check              lint + tests (local, no host needed)"
	@echo "make generate           regenerate theme table from \$$HOST (incl. user themes)"
	@echo "make generate-check     fail if plugin.js is out of date vs. \$$HOST (incl. user themes)"
	@echo "make install-hook       install hooks/hermes-skin-sync.sh into \$$INSTALL_HOOK_DIR (idempotent)"
	@echo "make uninstall          remove the hook installed by install-hook"
	@echo "make install-githooks   activate .githooks/ (pre-push generate-check) for this clone"

check: lint test

lint:
	node --check desktop/plugin.js
	python3 -m py_compile scripts/generate-themes.py __init__.py
	shellcheck hooks/hermes-skin-sync.sh tests/hook.sh .githooks/pre-push

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
