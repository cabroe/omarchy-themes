"""omarchy-themes agent hook entry point.

This plugin carries no agent-side hooks, tools, or slash-commands; the desktop
UI is the only consumer of the backend endpoints. We keep ``register(ctx)``
as a no-op so the plugin loader sees a valid Python module and the
``plugin.yaml`` is honored.
"""


def register(ctx) -> None:
    """No-op: the omarchy-themes plugin contributes no agent-side hooks."""
    return