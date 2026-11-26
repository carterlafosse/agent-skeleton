"""
Tool registry: write a function, describe it once, and the agent can use it.

The file has two halves:
  1. The registry (top): the machinery that turns Python functions into
     tools the model can request. Keep this as is.
  2. Example tools (bottom): a simple to-do list. Replace these with your
     own tools once you've seen how they work.
"""

# Everything the model sees about your tools: name, description, inputs.
# This list is sent with every request.
TOOLS = []

# Maps each tool name to the Python function that actually runs it.
# The model never sees this; it's how run_tool() finds the right code.
HANDLERS = {}


def tool(name, description, properties, required=None):
    """
    Decorator that registers a function as a tool.

    name         what the model calls the tool (keep it short and clear)
    description  what the tool does and when to use it. This is the ONLY
                 thing the model knows about your function, so be specific.
    properties   the tool's inputs, as a JSON Schema dict. Use {} for none.
    required     which inputs are mandatory. Defaults to all of them.
    """
    def register(fn):
        TOOLS.append({
            "name": name,
            "description": description,
            "input_schema": {
                "type": "object",
                "properties": properties,
                "required": required if required is not None else list(properties),
            },
        })
        HANDLERS[name] = fn
        return fn          # return the function unchanged so it still works normally
    return register


def run_tool(name, args):
    """
    Run the tool the model asked for and return its result.

    Errors are returned as text instead of crashing, so the model can read
    the problem and try again (e.g. with a different ID).
    """
    if name not in HANDLERS:
        return f"Unknown tool: {name}"
    # **args unpacks the model's inputs into named arguments,
    # e.g. {"item_id": 1} becomes complete_todo(item_id=1).
    return HANDLERS[name](**args)


# =============================================================================
# Example tools: a to-do list
#
# Everything below this line is example code. Delete it and add your own
# tools once you've seen how they work. Each tool is just:
#   1. @tool(...) describing it to the model
#   2. a normal Python function that does the work
# =============================================================================

# Fake data kept in memory, so it resets every time the script runs.
# In a real project this would be a database, file, or API.
TODOS = [
    {"id": 1, "text": "Pay rent", "done": False},
    {"id": 2, "text": "Book flights", "done": False},
]


# No inputs, so properties is {}.
@tool("list_todos", "List all to-do items with their IDs and done status.", {})
def list_todos():
    return TODOS


# One string input. The "description" inside properties helps the model
# fill in the value correctly.
@tool("add_todo", "Add an item to the to-do list. Returns the new item.",
      {"text": {"type": "string", "description": "What needs doing"}})
def add_todo(text):
    # Next ID is one higher than the current highest (or 1 if the list is empty).
    item = {"id": max((t["id"] for t in TODOS), default=0) + 1,
            "text": text, "done": False}
    TODOS.append(item)
    return item


# The input is named item_id rather than id, because id is a built-in
# Python function and shadowing it can cause subtle bugs.
@tool("complete_todo", "Mark a to-do item as done by its ID.",
      {"item_id": {"type": "integer", "description": "The item's ID"}})
def complete_todo(item_id):
    for t in TODOS:
        if t["id"] == item_id:
            t["done"] = True
            return f"Marked item {item_id} done"
    # Returning a clear message (instead of raising an error) lets the model
    # notice the mistake and recover, e.g. by listing items to find the right ID.
    return f"No item with ID {item_id}"