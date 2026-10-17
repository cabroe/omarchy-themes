"""omarchy-themes plugin — module shim.

The agent-side plugin loader (hermes_cli.plugins) requires ``__init__.py``
to be importable, while the dashboard-side loader (web_server_dashboard)
reads ``dashboard/manifest.json`` independently to mount FastAPI routers.
This shim exists only to satisfy the agent loader; the actual logic lives
in:

  • ``register.py``        — agent ``register(ctx)`` no-op
  • ``dashboard/plugin_api.py`` — FastAPI router (mounted by dashboard loader)
  • ``desktop/plugin.js``  — Hermes-Desktop renderer (loaded by Electron)

No agent-side hooks, tools, or slash-commands are registered — desktop UI
is the only consumer of the backend endpoints.
"""

from .register import register

__all__ = ["register"]
