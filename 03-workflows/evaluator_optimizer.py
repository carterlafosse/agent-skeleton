"""
Chapter 03d: Evaluator-optimiser

One call writes, a second call grades it against clear criteria, and the
writer revises using the feedback. Repeat until it passes or a limit is hit.

    write -> grade -> PASS? done : revise with feedback -> grade -> ...

Run from the project root:
    python 03-workflows/evaluator_optimizer.py
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from shared.llm import ask

# The grader is only as good as its criteria. Specific, checkable rules work
# far better than "make it good". Change these to suit your task.
# Tip: rules you can measure (word count, banned characters) are cheaper and
# more reliable to check in plain Python. See chaining.py.
CRITERIA = """\
- Under 10 words
- Mentions the product's main benefit
- No exclamation marks
- No clichés like "game-changer" or "next level"
"""


def generate(product, max_rounds=3):
    draft = ask(f"Write a one-line tagline for this product: {product}. "
                "Return only the tagline.")

    # Even a workflow's loop needs a cap: the grader might never be satisfied.
    for round_num in range(1, max_rounds + 1):
        print(f"[round {round_num}] {draft}")  # debug print, safe to remove

        # A separate grading call is more honest than asking the writer to
        # check its own work. Asking for PASS or a fix list keeps the reply
        # easy for code to read.
        verdict = ask(
            f"Check this tagline against the criteria.\n\nCriteria:\n{CRITERIA}\n"
            f"Tagline: {draft}\n\n"
            "If it meets every criterion, reply with exactly PASS. "
            "Otherwise list what to fix."
        )

        if verdict.startswith("PASS"):
            return draft

        print(f"  feedback: {verdict}")  # debug print, safe to remove
        draft = ask(f"Rewrite this tagline using the feedback. Return only the tagline.\n\n"
                    f"Tagline: {draft}\nFeedback: {verdict}")

    # Return the best attempt rather than nothing, and make it obvious it
    # didn't fully pass.
    return f"{draft}  (did not pass after {max_rounds} rounds)"


if __name__ == "__main__":
    # Change this to any product.
    print("\nFinal: " + generate("a reusable water bottle that tracks how much you drink"))