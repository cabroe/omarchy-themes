# Security policy

## What runs where

- `desktop/plugin.js` runs inside the Hermes Desktop renderer, limited to the
  plugin SDK surface (`hermes plugins validate` checks that). It has no network
  access of its own; it reads two local files through the desktop's file-watch
  bridge (`~/.local/state/omarchy/current/theme.name` and
  `<HERMES_HOME>/config.yaml`) and writes only the desktop's own appearance keys
  in `localStorage`.
- `hooks/hermes-skin-sync.sh` runs as your user from Omarchy's `theme-set.d`
  hook chain. It writes `~/.hermes/skins/<slug>.yaml` and calls `hermes skin use`.
  It never exits non-zero, so it cannot break the hook chain.
- The `.github/workflows/live-theme-smoke.yml` job runs on the **omarchy
  self-hosted GitHub Actions runner** (labels `self-hosted, omarchy,
  omarchy-themes`). The runner is a label-pinned install on the omarchy
  workstation; it is **not** reachable by any other workflow in this repo or
  any other repository. The job has only `contents: read`, no cloud credentials,
  no GitHub token, and no other secrets. Its only side effect is running
  `tests/theme-switch-smoke.sh`, which exercises `omarchy theme set` end-to-end
  through the real hook chain and restores the active skin afterwards.

## Self-hosted runner on a workstation — what that means

The omarchy runner is on the maintainer's user workstation, not a dedicated CI
host. It is **only started on-demand**, not 24/7. Risks and mitigations:

- **Risk:** a compromised dependency (`actions/checkout` etc.) would have the
  rights of the runner user. **Mitigation:** actions are pinned to commit SHA,
  not tags; the job declares `permissions: contents: read` only.
- **Risk:** anyone who can trigger a workflow in this repo could run code on
  the workstation. **Mitigation:** the runner is label-pinned (`omarchy`,
  `omarchy-themes`) and the only workflow that requests it is the live-smoke
  one; no `pull_request_target` or untrusted-PR flow ever runs on it.
- **Risk:** the runner token is long-lived. **Mitigation:** the token scopes
  only this repository's runner registration; rotation is
  `Settings → Actions → Runners → Remove`, then re-register.
- **Risk:** the live smoke mutates user state (active skin). **Mitigation:**
  the test captures `ACTIVE_BEFORE` and restores it on exit; the
  `workflow_dispatch` trigger is manual so the maintainer is at the keyboard
  when it runs.

## Reporting a vulnerability

Please do **not** open a public issue. Use GitHub's private vulnerability
reporting (Security tab → "Report a vulnerability"), or mail the maintainer
(address on the GitHub profile). You will get an answer within a week.

## Supported versions

Only the latest release / `main` is supported.
