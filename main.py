"""
Runs the Chapter 04 team, for watching in the Chapter 05 visualizer.

Start the server and dashboard first (see 05-visualizer/README.md), then:
    python main.py

Works without the dashboard too; you'll just see the usual printed output.
"""

import sys
from pathlib import Path

# Make the Chapter 04 files importable from here.
sys.path.append(str(Path(__file__).resolve().parent / "04-multi-agent"))

from lead import run_team

if __name__ == "__main__":
    # Change this to any goal you want to watch the team work on. Asking for
    # several concrete items per part gives the workers more to do, which
    # makes for a better show.
    goal = ("Get me organised for moving apartments next month. "
            "Break each part into several concrete to-do items.")

    # parallel=True runs every worker at the same time, so the whole team
    # lights up at once in the dashboard.
    print("\n=== Lead summary ===\n" + run_team(goal, parallel=True))
