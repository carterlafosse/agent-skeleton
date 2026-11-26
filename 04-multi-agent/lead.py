"""
Chapter 04: Multi-agent (lead + workers)

A lead splits a goal into smaller tasks, hands each one to a worker agent,
then combines their results into one answer for you.

    goal -> lead plans tasks -> worker per task -> lead summarises

Here the workers share the to-do tools from shared/tools.py, so each one
adds items for its part of the goal and you end up with one combined list.

Run from the project root:
    python 04-multi-agent/lead.py
"""

import sys, json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
sys.path.append(str(Path(__file__).resolve().parents[1]))

from shared.llm import ask
from shared.tools import list_todos
from shared.emit import emit   # feeds the Chapter 05 visualizer; does nothing if it's off
from task_list import TASKS, add_task, start_task, complete_task, show_tasks
from worker import run_worker


def plan(goal):
    """Ask the model to split the goal into independent tasks."""
    text = ask("You are a team lead. Split this goal into 2-4 independent tasks "
               "that different people could do separately. Keep each task "
               "short: a few words, like 'Book movers'.\n\n"
               f"Goal: {goal}\n\n"
               "Return only a JSON array of strings, with no other text.")

    # Models sometimes wrap JSON in ```json ... ``` fences, so strip those
    # before parsing.
    text = text.strip().strip("`").removeprefix("json").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # If the plan can't be read, fall back to one worker doing everything
        # rather than crashing.
        return [goal]


def run_team(goal, parallel=False):
    """
    goal      what you want the team to do
    parallel  False: workers take turns (easier to follow in the terminal).
              True: all workers run at the same time (faster, and much more
              fun to watch in the Chapter 05 visualizer).
    """
    print(f"Goal: {goal}")
    emit("run_started", goal=goal)

    # --- 1. Plan: the lead breaks the goal into tasks --------------------------
    for description in plan(goal):
        add_task(description)
    show_tasks()

    # --- 2. Delegate: one worker per task ---------------------------------------
    emit("lead_status", status="delegating")

    def work(task):
        name = f"worker-{task['id']}"
        print(f"\n[{name}] starting: {task['description']}")
        start_task(task["id"], name)
        summary = run_worker(name, goal, task["description"])
        complete_task(task["id"], name, summary)

    if parallel:
        # Same thread-pool idea as parallel.py in Chapter 03. Workers share the
        # to-do list, so run_tool() uses a lock to stop them clashing.
        # Printed output will interleave, which is expected.
        with ThreadPoolExecutor() as pool:
            list(pool.map(work, TASKS))
    else:
        for task in TASKS:
            work(task)
    show_tasks()

    # --- 3. Combine: the lead turns the results into one answer -----------------
    emit("lead_status", status="summarising")
    results = "\n".join(f"- {t['description']}: {t['result']}" for t in TASKS)
    final = ask("You are the team lead. Your workers finished these tasks:\n"
                f"{results}\n\nCurrent to-do list:\n{json.dumps(list_todos())}\n\n"
                "Write a short summary for the user: what the team did and "
                "what's on their list now.")
    emit("run_done", summary=final)
    return final


if __name__ == "__main__":
    # Change this to your own goal. Goals that split naturally into separate
    # parts work best.
    print("\n=== Lead summary ===\n" +
          run_team("Get me organised for moving apartments next month."))