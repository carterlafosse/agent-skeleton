"""
Chapter 04: Shared task list

The team's progress board. The lead adds tasks, marks them in progress when
a worker starts, and records each worker's result when it finishes.

Not to be confused with the to-do tools in shared/tools.py: those are the
data the workers act on. This list tracks the team's own work.

Each change also calls emit(), which feeds the Chapter 05 visualizer. If the
visualizer isn't running, emit() does nothing.

This file isn't run directly; lead.py uses it.
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from shared.emit import emit

# Kept in memory, so it resets every run. A real system might use a database
# or a file so several processes can share it.
TASKS = []


def add_task(description):
    task = {"id": len(TASKS) + 1, "description": description,
            "status": "pending", "result": None}
    TASKS.append(task)
    emit("task_added", task_id=task["id"], description=description)
    return task


def _get(task_id):
    # Leading underscore = internal helper, only used inside this file.
    return next(t for t in TASKS if t["id"] == task_id)


def start_task(task_id, agent):
    _get(task_id)["status"] = "in_progress"
    emit("task_started", task_id=task_id, agent=agent)


def complete_task(task_id, agent, result):
    task = _get(task_id)
    task["status"] = "done"
    task["result"] = result
    emit("task_done", task_id=task_id, agent=agent, result=result)


def show_tasks():
    # Simple text view of the board. Chapter 05 adds a live graph.
    print("\nTask board:")
    for t in TASKS:
        print(f"  {t['id']}. [{t['status']}] {t['description']}")
