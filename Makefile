HOST ?= omarchy

.PHONY: help check test lint generate generate-check

help:
	@echo "make check            lint + tests (local, no host needed)"
	@echo "make generate         regenerate theme table from \$$HOST (incl. user themes)"
	@echo "make generate-check   fail if plugin.js is out of date vs. \$$HOST (incl. user themes)"

check: lint test

lint:
	node --check desktop/plugin.js
	python3 -m py_compile scripts/generate-themes.py
	shellcheck hooks/hermes-skin-sync.sh tests/hook.sh

test:
	node tests/smoke.mjs
	sh tests/hook.sh

generate:
	python3 scripts/generate-themes.py --remote $(HOST) --include-user

generate-check:
	python3 scripts/generate-themes.py --remote $(HOST) --include-user --check
