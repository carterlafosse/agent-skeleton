"""
Chapter 01: One tool call, start to finish (no loop yet)

The model gets a question and a menu of tools. If it needs data it doesn't
have, it asks for a tool; this script runs that tool, sends the result back,
and prints the model's final answer.

Run from the project root:
    python 01-single-call/single_call.py
"""

import sys, json
from pathlib import Path

# Folders starting with a number (01-...) can't be imported as Python
# modules, so add the project root to the import path to reach shared/.
sys.path.append(str(Path(__file__).resolve().parents[1]))

from shared.llm import llm                  # sends messages to the model
from shared.tools import TOOLS, run_tool    # tool menu + the function that runs them

# Change this to your own question. Pick one that needs a tool, or the model
# will just answer directly and skip steps 2-3.
# The model is stateless: it remembers nothing between calls, so this list
# holds the whole conversation and is resent each time.
messages = [{"role": "user", "content": "What's on my to-do list?"}]

# --- Step 1: the model decides whether it needs a tool ----------------------
resp = llm(messages, tools=TOOLS)

# stop_reason is "tool_use" when the model wants a tool run, or "end_turn"
# when it's done and answered normally.
# Debug print: remove it once you're comfortable with the flow.
print("stop_reason:", resp.stop_reason)

if resp.stop_reason == "tool_use":
    # The reply is a list of content blocks (text, tool requests, etc.).
    # Grab the first tool request.
    call = next(b for b in resp.content if b.type == "tool_use")
    print(f"Model asked for: {call.name}({call.input})")  # debug print, safe to remove

    # --- Step 2: YOUR code runs the tool -------------------------------------
    # The model never executes anything; it only requests. Running it here is
    # what keeps permissions and validation in your hands.
    result = run_tool(call.name, call.input)

    # --- Step 3: send back the model's request + the result -----------------
    # The model's own reply goes in first so it remembers what it asked for.
    messages.append({"role": "assistant", "content": resp.content})

    # tool_use_id ties the result to the exact request it answers.
    messages.append({"role": "user", "content": [{
        "type": "tool_result",
        "tool_use_id": call.id,
        "content": json.dumps(result),   # tool output must be sent as text
    }]})

    resp = llm(messages, tools=TOOLS)

# --- Step 4: print only the text blocks of the final reply -------------------
print("\nFinal answer:")
print("".join(b.text for b in resp.content if b.type == "text"))

# Limitation: only ONE tool call is handled. If the model needs to chain tools
# (list items, then complete one), see Chapter 02's loop.
# You can remove this note once you've moved on.