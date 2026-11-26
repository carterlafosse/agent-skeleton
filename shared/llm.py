"""
Thin wrapper around the Anthropic SDK so every chapter calls the model the
same way.

If you want to switch providers or add logging, retries, or cost tracking,
this is the one place to do it: every chapter goes through llm().
"""

import os
from dotenv import load_dotenv
from anthropic import Anthropic

# Load settings from the .env file in the project root.
# override=True makes .env win over any ANTHROPIC_* variables already set on
# your machine (other tools sometimes set these and cause confusing 401 errors).
load_dotenv(override=True)

# The client handles authentication and HTTP for us. Your key comes from
# .env and should never be written directly into code or committed.
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Which model to use. To change it, add a line like MODEL=claude-haiku-5-5 to
# your .env rather than editing this file. Smaller models are cheaper and
# faster, which is handy while you're experimenting.
MODEL = os.getenv("MODEL", "claude-sonnet-5-5")


def llm(messages, tools=None, system=None, max_tokens=1024):
    """
    Send a conversation to the model and return its full response.

    messages    the conversation so far, as a list of {"role", "content"} dicts
    tools       optional list of tool definitions the model may request
    system      optional instructions that shape the model's behaviour
                (e.g. "You are a concise assistant"), kept separate from
                the conversation itself
    max_tokens  upper limit on the length of the reply. Raise it if answers
                get cut off mid-sentence.
    """
    kwargs = {"model": MODEL, "max_tokens": max_tokens, "messages": messages}

    # Only include optional settings when they're provided; the API treats a
    # missing field differently from an empty one.
    if tools:
        kwargs["tools"] = tools
    if system:
        kwargs["system"] = system

    # Returns the raw response object. Chapters read .stop_reason and
    # .content from it directly so you can see exactly what the API returns.
    return client.messages.create(**kwargs)