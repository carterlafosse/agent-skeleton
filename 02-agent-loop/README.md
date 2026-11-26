# 02 — Agent Loop

Chapter 01 made one tool call. This chapter puts the same steps inside a loop, so the model can keep calling tools until the task is done. That loop is the core of every agent.

## Run it

```bash
python 02-agent-loop/agent_loop.py
```

Expected output (yours may differ slightly; the model chooses its own order):

```
[step 1] add_todo({'text': 'buy milk'})
[step 1] add_todo({'text': 'call the dentist'})
[step 1] list_todos({})
[step 2] complete_todo({'item_id': 1})
[step 3] list_todos({})

Final answer:
I added the two items and marked "Pay rent" as done. Your list now looks like this:

1. ✅ Pay rent
2. ⬜ Book flights
3. ⬜ buy milk
4. ⬜ call the dentist
```
Notice two things in that run:
- **Step 1 has three tool calls.** The model can request several tools at once, and the loop runs them all.
- **Step 2 depends on step 1.** The model couldn't complete "Pay rent" until it had listed the items to find its ID. Chapter 01 can't do that.

## The loop

```
          ┌─────────────────────────────────────┐
          ▼                                     │
   Think: model reads the conversation          │
          │                                     │
          ├── no tool requested ──▶ return answer
          │
   Act: your code runs each requested tool
          │
   Observe: results added to the conversation ──┘
```

1. **Think.** Send the whole conversation plus the tool menu.
2. **Done?** If `stop_reason` isn't `"tool_use"`, the model is answering. Return it.
3. **Act.** Run every tool the model asked for this round.
4. **Observe.** Send all the results back in one message, then loop.

## Why it works this way

- **One call can't see results.** A single request is one prediction made blind. Real tasks need feedback: list the items, *then* complete the right one. The loop gives the model results to react to.
- **The model decides when it's done.** Your code doesn't plan the steps; the model picks the next action each round. That flexibility is what separates an agent from a fixed script.
- **Your code sets the limits.** The model has no sense of cost or time and may never stop, so `max_steps` is a hard cap that lives outside the model.
- **Errors are just more information.** Returning `"Error: ..."` as a tool result lets the model notice and recover instead of crashing the program.
- **All results in one message.** When the model requests several tools at once, the API expects every result together in a single reply.

## Compared to Chapter 01

| | Chapter 01 | Chapter 02 |
|---|---|---|
| Tool calls | One | As many as needed |
| Control flow | `if` | `for` loop with `max_steps` |
| Multiple tools per round | No | Yes |
| Error handling | None | `try/except`, errors sent back to the model |

## Make it yours

- Change the task at the bottom of `agent_loop.py`.
- Add tools in `shared/tools.py` with `@tool(...)`. The loop picks them up automatically.
- Copy `run_agent()` into your own project. It only needs `shared/llm.py` and `shared/tools.py`.

## Limitation

The model decides every step, which is flexible but less predictable. For tasks where you already know the steps, a fixed sequence is cheaper and more reliable.

➡️ **Next: [03 — Workflows](../03-workflows/)**, where your code sets the path and the model handles each step.