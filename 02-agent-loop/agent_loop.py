"""
Chapter 02: The agent loop

Chapter 01 handled one tool call. Here the same steps run inside a loop, so
the model can call a tool, look at the result, decide what to do next, and
keep going until it's finished. That loop is what makes something an "agent".

Run from the project root:
    python 02-agent-loop/agent_loop.py
"""

import sys, json
from pathlib import Path

# Same import fix as Chapter 01: lets this folder reach shared/.
sys.path.append(str(Path(__file__).resolve().parents[1]))

from shared.llm import llm
from shared.tools import TOOLS, run_tool


def run_agent(task, max_steps=10):
    """
    Give the model a task and let it use tools until it's done.

    task       what you want done, in plain language
    max_steps  safety limit on how many rounds the loop can run. The model
               decides when it's finished, and it can get that wrong or loop
               forever, so your code needs a hard stop.
    """
    # The whole conversation lives here and is resent every round,
    # because the model remembers nothing between calls.
    messages = [{"role": "user", "content": task}]

    for step in range(1, max_steps + 1):

        # --- Think: the model looks at everything so far and decides ---------
        resp = llm(messages, tools=TOOLS)

        # Save the model's reply so it remembers what it asked for next round.
        messages.append({"role": "assistant", "content": resp.content})

        # --- Done? If it didn't ask for a tool, it's giving its final answer -
        if resp.stop_reason != "tool_use":
            return "".join(b.text for b in resp.content if b.type == "text")

        # --- Act: run every tool the model asked for this round --------------
        # The model can request several tools at once, so collect all the
        # results and send them back together.
        results = []
        for call in (b for b in resp.content if b.type == "tool_use"):
            # Shows each step as it happens. Remove it if you want quiet output.
            print(f"[step {step}] {call.name}({call.input})")

            try:
                result = run_tool(call.name, call.input)
            except Exception as e:
                # Send errors back as text instead of crashing. The model reads
                # the error like any other result and can try a different approach.
                result = f"Error: {e}"

            results.append({
                "type": "tool_result",
                "tool_use_id": call.id,          # links the result to its request
                "content": json.dumps(result),
            })

        # --- Observe: all results go back in ONE message ---------------------
        # The API expects every result from a round in a single user message.
        # Sending them separately causes an error.
        messages.append({"role": "user", "content": results})

    # Only reached if the loop never finished. Returning a message (rather than
    # raising an error) keeps the program running so you can see what happened.
    return f"Stopped: hit max_steps ({max_steps}) without finishing."


if __name__ == "__main__":
    # Change this to your own task. Good tests need several tool calls in a
    # row, where each step depends on the result of the one before.
    # This one makes the model list items first to find the ID for "pay rent".
    answer = run_agent(
        "Add 'buy milk' and 'call the dentist' to my list, "
        "mark 'pay rent' as done, then show me the updated list."
    )
    print("\nFinal answer:\n" + answer)