"""
Chapter 04: Shared task list

The team's progress board. The lead adds tasks, marks them in progress when
a worker starts, and records each worker's result when it finishes.

Not to be confused with the to-do tools in shared/tools.py: those are the
data the workers act on. This list tracks the team's own work.

This file isn't run directly; lead.py uses it.
"""

# Kept in memory, so it resets every run. A real system might use a database
# or a file so several processes can share it.
TASKS = []


def add_task(description):
    task = {"id": len(TASKS) + 1, "description": description,
            "status": "pending", "result": None}
    TASKS.append(task)
    return task


def _get(task_id):
    # Leading underscore = internal helper, only used inside this file.
    return next(t for t in TASKS if t["id"] == task_id)


def start_task(task_id):
    _get(task_id)["status"] = "in_progress"


def complete_task(task_id, result):
    task = _get(task_id)
    task["status"] = "done"
    task["result"] = result


def show_tasks():
    # Simple text view of the board. Chapter 05 replaces this with a live graph.
    print("\nTask board:")
    for t in TASKS:
        print(f"  {t['id']}. [{t['status']}] {t['description']}")