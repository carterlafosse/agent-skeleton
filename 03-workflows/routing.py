"""
Chapter 03b: Routing

One quick call classifies the input, then your code sends it down the right
path. Each path gets its own specialised prompt.

    message -> classify -> question | complaint | feedback -> tailored reply

Run from the project root:
    python 03-workflows/routing.py
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from shared.llm import ask

# One specialised instruction per category. Replace these with your own
# categories and prompts; the routing logic below doesn't need to change.
ROUTES = {
    "question":  "Answer this customer question clearly and briefly.",
    "complaint": "Respond to this complaint with empathy, apologise, and offer a next step.",
    "feedback":  "Thank the customer for this feedback and say how it will be used.",
}

# Used when the classifier returns something unexpected. Models sometimes go
# off-script, so always have a safe default.
FALLBACK = "Reply politely and ask a clarifying question."

# A system prompt sets the role and rules for every reply, so each route's
# instruction only has to cover what's different. Without it, the model may
# write templates with placeholders or add notes meant for you.
SYSTEM = ("You are a support agent replying directly to a customer. "
          "Write only the reply itself: no subject line, no placeholders, "
          "no notes or tips. Keep it under 80 words.")


def classify(message):
    # Forcing a one-word answer lets plain Python branch on the result.
    # .lower() and .strip(".") clean up small variations like "Question."
    label = ask(
        "Classify this message as exactly one word: question, complaint, or feedback.\n\n"
        f"Message: {message}"
    )
    return label.lower().strip(". ")


def handle(message):
    category = classify(message)
    instruction = ROUTES.get(category, FALLBACK)   # .get() falls back if the label is unknown
    reply = ask(f"{instruction}\n\nMessage: {message}", system=SYSTEM)
    return category, reply


if __name__ == "__main__":
    # Change or add messages to see how each one gets routed.
    examples = [
        "How do I reset my password?",
        "My order arrived broken and nobody has answered my emails.",
        "Love the new dark mode, it's much easier on my eyes!",
    ]
    for msg in examples:
        category, reply = handle(msg)
        print(f"\n[{category}] {msg}\n-> {reply}")