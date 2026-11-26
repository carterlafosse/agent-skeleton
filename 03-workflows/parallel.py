"""
Chapter 03c: Parallelisation

Run several independent calls at the same time, then combine the results.
Here, three reviewers each check a piece of writing from a different angle,
and a final call merges their notes.

    text -> [clarity, tone, accuracy] at once -> merge into one review

Run from the project root:
    python 03-workflows/parallel.py
"""

import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
sys.path.append(str(Path(__file__).resolve().parents[1]))

from shared.llm import ask

# Each reviewer gets one narrow job. A single "review everything" prompt tends
# to focus on one kind of issue and miss the rest. Swap in your own angles.
REVIEWERS = {
    "clarity":  "Point out anything confusing or hard to follow.",
    "tone":     "Point out anything that sounds rude, robotic, or off-brand.",
    "accuracy": "Point out any claims that seem wrong or need a source.",
}


def review(text):
    def run_reviewer(item):
        name, instruction = item
        notes = ask(f"{instruction} Be brief, max 3 bullet points.\n\nText:\n{text}")
        return name, notes

    # Threads let the three API calls wait on the network at the same time,
    # so this takes about as long as the slowest reviewer instead of all
    # three added together.
    with ThreadPoolExecutor() as pool:
        results = dict(pool.map(run_reviewer, REVIEWERS.items()))

    for name, notes in results.items():
        print(f"--- {name} ---\n{notes}\n")  # debug print, safe to remove

    # Combine step: one call merges and de-duplicates the separate reviews.
    combined = "\n\n".join(f"{name.upper()}:\n{notes}" for name, notes in results.items())
    return ask("Merge these reviews into one short, prioritised list of fixes. "
               f"Remove duplicates.\n\n{combined}")


if __name__ == "__main__":
    # Change this to any text you want reviewed.
    sample = ("Our app is the best in the world and literally everyone uses it. "
              "To login you must first go to settings, but not that settings, the other one.")
    print("=== Final review ===\n" + review(sample))