"""
Sends events to the visualizer dashboard (Chapter 05).

Any chapter can call emit() to report what an agent is doing: a task
starting, a tool being called, a task finishing. The dashboard turns those
events into a live graph.

If the dashboard server isn't running, emit() quietly switches itself off,
so agents behave exactly the same with or without it.
"""

import os
import time
import requests

# Where the Chapter 05 server listens. Override with DASHBOARD_URL in .env
# if you run it somewhere else.
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "http://localhost:4000/events")

# Flips to False after the first failed send, so a missing server costs one
# short timeout instead of slowing down every event.
_enabled = True


def emit(event_type, **data):
    """
    Report one event, e.g. emit("tool_call", agent="worker-1", tool="add_todo").

    event_type  what happened (see the event list in 05-visualizer/README.md)
    **data      any extra details; they're sent as JSON fields
    """
    global _enabled
    if not _enabled:
        return
    try:
        requests.post(DASHBOARD_URL,
                      json={"type": event_type, "ts": time.time(), **data},
                      timeout=0.5)
    except requests.RequestException:
        # Never let the dashboard break the agent. Switch off and carry on.
        _enabled = False
