# 01 — Single Tool Call

The smallest useful unit of an agent: the model asks for a tool, your code runs it, and the model uses the result to answer.

No loop yet. This chapter does exactly one round trip.

## Run it

```bash
python 01-single-call/single_call.py
```

Expected output (wording varies slightly each run):

```
stop_reason: tool_use
Model asked for: list_todos({})

Final answer:
You have two items on your to-do list, and neither is done yet:

1. Pay rent
2. Book flights
```

## What happens

```
You ──"What's on my list?"──▶ Model
                                │  "I need list_todos()"
                                ▼
                     Your code runs list_todos()
                                │  the items
                                ▼
                              Model ──answer──▶ You
```

1. **Send the question plus a list of tools.** Each tool has a name, a description and a JSON schema for its inputs.
2. **The model replies with `stop_reason: "tool_use"`** and a `tool_use` block naming the tool and its arguments.
3. **Your code runs the tool.** The model never executes anything itself.
4. **Send back the model's request plus a `tool_result`**, matched by `tool_use_id`.
5. **The model answers** using the real data.

## Why it works this way

- **An LLM only produces text.** A tool call is a structured request for *your code* to do something.
- **Your code stays in control.** You run the tool, so you decide what's allowed.
- **The model is stateless.** It doesn't remember the first call, so step 4 resends the whole conversation.
- **The description is the interface.** The model can't see your function, only its name, description and schema.

## Make it yours

Tools live in `shared/tools.py`. To add one, write a function and put `@tool(...)` above it:

```python
@tool("get_time", "Get the current time.", {})
def get_time():
    from datetime import datetime
    return datetime.now().strftime("%H:%M")
```

No other changes needed. The model can now use it.

## Files

| File | Purpose |
|---|---|
| `single_call.py` | This chapter's example |
| `../shared/llm.py` | `llm()` wrapper around the Anthropic SDK |
| `../shared/tools.py` | Tool registry + example to-do tools |

## Limitation

This handles only **one** tool call. If the model needs to list items *and then* mark one done, this code can't do it.

➡️ **Next: [02 — Agent Loop](../02-agent-loop/)**