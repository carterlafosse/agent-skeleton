"""
Runs the Chapter 04 team, for watching in the Chapter 05 visualizer.

Two ways to start a run:
  1. From the dashboard: the New run button (it starts this file for you).
  2. From a terminal, with an optional goal:
         python main.py
         python main.py "Plan a birthday party for 20 people"

Works without the dashboard too; you'll just see the usual printed output.
"""

import sys
from pathlib import Path

# Make the Chapter 04 files importable from here.
sys.path.append(str(Path(__file__).resolve().parent / "04-multi-agent"))

from lead import run_team

# Used when no goal is given. Asking for several concrete items per part
# gives the workers more to do, which makes for a better show.
DEFAULT_GOAL = ("Get me organised for moving apartments next month. "
                "Break each part into several concrete to-do items.")

if __name__ == "__main__":
    goal = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_GOAL

    # parallel=True runs every worker at the same time, so the whole team
    # lights up at once in the dashboard.
    print("\n=== Lead summary ===\n" + run_team(goal, parallel=True))
