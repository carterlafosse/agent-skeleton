"""
Human approval for risky tool calls (Chapter 05).

Tools marked risky=True in shared/tools.py can be made to pause until a
person clicks Approve or Deny in the dashboard. Which calls need approval
depends on APPROVAL_MODE, which the dashboard sets when it starts a run:

    off    nothing needs approval (the default, e.g. running from a terminal)
    risky  only tools marked risky=True
    all    every tool call

Safe by default: if nobody answers in time, or the dashboard can't be
reached, the action is treated as denied.
"""

import os
import time
import uuid
import requests

from shared.emit import emit, DASHBOARD_URL
from shared.tools import RISKY_TOOLS

# The server's base address, e.g. http://localhost:4000
SERVER_URL = DASHBOARD_URL.rsplit("/events", 1)[0]


def needs_approval(tool_name):
    mode = os.getenv("APPROVAL_MODE", "off")
    if mode == "all":
        return True
    if mode == "risky":
        return tool_name in RISKY_TOOLS
    return False


def request_approval(agent, tool, args, timeout=300):
    """
    Ask the person watching the dashboard. Blocks this worker until they
    answer (other workers keep going). Returns True if approved.
    """
    approval_id = uuid.uuid4().hex[:8]
    emit("approval_requested", approval_id=approval_id, agent=agent, tool=tool, args=args)
    print(f"  [{agent}] waiting for approval: {tool}({args})")

    # Check every half second whether a decision has been made.
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            status = requests.get(f"{SERVER_URL}/approvals/{approval_id}", timeout=2).json()["status"]
        except requests.RequestException:
            return False  # dashboard unreachable: deny to be safe
        if status in ("approved", "denied"):
            print(f"  [{agent}] {status}: {tool}")
            return status == "approved"
        time.sleep(0.5)

    return False  # no answer in time: deny to be safe
