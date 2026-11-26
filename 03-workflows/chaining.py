"""
Chapter 03a: Chaining

Break a task into fixed steps, where each step's output becomes the next
step's input. Your code decides the order; the model just does each step.
The last step also shows a code check: rules you can measure (like word
count) should be enforced in Python, not just asked for in the prompt.

    topic -> outline -> draft -> edit (-> retry if too long)

Run from the project root:
    python 03-workflows/chaining.py
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from shared.llm import ask


def write_post(topic):
    # Step 1: plan. Small, focused prompts are far more reliable than one
    # giant prompt that tries to do everything at once.
    outline = ask(f"Write a 3-point outline for a short blog post about: {topic}. "
                  "Return only the 3 points, one per line.")
    print("--- Outline ---\n" + outline)  # debug print, safe to remove

    # Step 2: draft from the outline. The previous output is pasted straight
    # into the next prompt; that hand-off is the whole idea of chaining.
    draft = ask(f"Write a short blog post following this outline:\n\n{outline}")
    print("\n--- Draft ---\n" + draft)  # debug print, safe to remove

    # Step 3: edit. A separate pass with one job (tighten it) usually beats
    # asking for a perfect result in a single step.
    final = ask("Edit this post to under 120 words. Keep the three main points. "
                f"Return only the edited post.\n\n{draft}")

    # Models can't count words reliably, so a limit in the prompt is only a
    # suggestion. Check it in code, and if it's over, tell the model the
    # actual count and ask again. Two retries is usually enough.
    for _ in range(2):
        words = len(final.split())
        if words <= 120:
            break
        print(f"(edit was {words} words, retrying)")  # debug print, safe to remove
        final = ask(f"This post is {words} words. Cut it to under 110 words. "
                    f"Keep the three main points. Return only the post.\n\n{final}")
    return final


if __name__ == "__main__":
    # Change this to any topic you like.
    result = write_post("why sleep matters for learning")
    print("\n--- Final ---\n" + result)