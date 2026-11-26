"""
Chapter 04: Worker

A worker is the Chapter 02 agent loop with two additions:
  - a system prompt giving it a name and a narrow job
  - the overall goal, so it understands where its task fits

This file isn't run directly; lead.py calls run_worker() for each task.
"""

import sys, json
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from shared.llm import llm
from shared.tools import TOOLS, run_tool


def run_worker(name, goal, task, max_steps=10):
    """
    Run one worker on one task and return its short summary.

    name   label used in printed output (and later in the visualizer)
    goal   the team's overall goal, for context
    task   this worker's specific piece of the work
    """
    # Workers don't see the lead's conversation. Everything they need to
    # know has to be in this prompt, so be explicit about scope.
    system = (f"You are {name}, one worker on a small team. Do ONLY your assigned "
              "task, using the tools available. Don't do other workers' tasks. "
              "When finished, reply with a one-sentence summary of what you did.")

    messages = [{"role": "user",
                 "content": f"Overall goal: {goal}\n\nYour task: {task}"}]

    # Same loop as Chapter 02: think, act, observe, repeat until done.
    for step in range(1, max_steps + 1):
        resp = llm(messages, tools=TOOLS, system=system)
        messages.append({"role": "assistant", "content": resp.content})

        if resp.stop_reason != "tool_use":
            return "".join(b.text for b in resp.content if b.type == "text")

        results = []
        for call in (b for b in resp.content if b.type == "tool_use"):
            print(f"  [{name}] {call.name}({call.input})")  # debug print, safe to remove
            try:
                result = run_tool(call.name, call.input)
            except Exception as e:
                result = f"Error: {e}"
            results.append({"type": "tool_result", "tool_use_id": call.id,
                            "content": json.dumps(result)})
        messages.append({"role": "user", "content": results})

    return f"Stopped: hit max_steps ({max_steps}) without finishing."