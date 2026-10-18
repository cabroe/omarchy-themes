# omarchy-themes: pure desktop plugin — no agent-side registration.
# This shim exists so the Hermes agent-side plugin loader can discover the
# package without warnings (Unified-Package mode requires an importable
# __init__.py even when there is no Python backend).


def register(ctx):  # noqa: ARG001
    """No-op: this plugin's logic lives entirely in desktop/plugin.js."""
    pass
