"""
One place that talks to the AI model, so every chapter works with any provider.

Pick a provider with PROVIDER= in your .env file:

    anthropic   Claude (the default)
    openai      ChatGPT models
    gemini      Google Gemini
    deepseek    DeepSeek
    grok        xAI Grok
    github      GitHub Models (free tier with a GitHub token; the closest thing
                to a Copilot API, since Microsoft Copilot itself has no public API)
    openrouter  One key for hundreds of models from many providers
    ollama      Models running locally on your own computer (free, no key)

Every provider except Anthropic is reached through OpenAI's API format,
which they all support. Their replies are converted to the same shape as
Claude's, so the chapters never need to know which provider is in use.

To add logging, retries, or cost tracking, this is the one place to do it:
every chapter goes through llm().
"""

import os
import json
from types import SimpleNamespace
from dotenv import load_dotenv

# Load settings from the .env file in the project root.
# override=True makes .env win over any variables already set on your machine
# (other tools sometimes set these and cause confusing 401 errors).
load_dotenv(override=True)

# Default model and API key name for each provider. Model names change often:
# if one stops working, check the provider's docs and set MODEL= in .env.
PROVIDERS = {
    "anthropic":  {"model": "claude-sonnet-5-5", "key": "ANTHROPIC_API_KEY"},
    "openai":     {"model": "gpt-5.5", "key": "OPENAI_API_KEY",
                   "base_url": None},  # None = OpenAI's own address
    "gemini":     {"model": "gemini-3.8-flash", "key": "GEMINI_API_KEY",
                   "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/"},
    "deepseek":   {"model": "deepseek-flash", "key": "DEEPSEEK_API_KEY",
                   "base_url": "https://api.deepseek.com"},
    "grok":       {"model": "grok-4.6", "key": "XAI_API_KEY",
                   "base_url": "https://api.x.ai/v1"},
    "github":     {"model": "openai/gpt-4.1", "key": "GITHUB_TOKEN",
                   "base_url": "https://models.github.ai/inference"},
    "openrouter": {"model": "openrouter/auto", "key": "OPENROUTER_API_KEY",
                   "base_url": "https://openrouter.ai/api/v1"},
    "ollama":     {"model": "llama3.2", "key": None,
                   "base_url": "http://localhost:11434/v1"},
}

PROVIDER = os.getenv("PROVIDER", "anthropic").lower()
if PROVIDER not in PROVIDERS:
    raise ValueError(f"Unknown PROVIDER '{PROVIDER}'. Choose one of: {', '.join(PROVIDERS)}")

_settings = PROVIDERS[PROVIDER]

# Set MODEL= in .env to use a different model from the same provider.
MODEL = os.getenv("MODEL", _settings["model"])

# Set BASE_URL= in .env to point at any other OpenAI-compatible service.
_base_url = os.getenv("BASE_URL", _settings.get("base_url"))
_api_key = os.getenv(_settings["key"]) if _settings["key"] else "not-needed"

# Only the SDK for the chosen provider is imported, so you only need that one
# installed (both are in requirements.txt).
if PROVIDER == "anthropic":
    from anthropic import Anthropic
    client = Anthropic(api_key=_api_key)
else:
    from openai import OpenAI
    client = OpenAI(api_key=_api_key, base_url=_base_url)


def llm(messages, tools=None, system=None, max_tokens=1024):
    """
    Send a conversation to the model and return its full response.

    messages    the conversation so far, as a list of {"role", "content"} dicts
    tools       optional list of tool definitions the model may request
    system      optional instructions that shape the model's behaviour
                (e.g. "You are a concise assistant"), kept separate from
                the conversation itself
    max_tokens  upper limit on the length of a Claude reply. Raise it if
                answers get cut off mid-sentence.

    Always returns Claude's response shape: .stop_reason and .content blocks.
    """
    if PROVIDER != "anthropic":
        return _openai_style_llm(messages, tools, system)

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


def ask(prompt, system=None, max_tokens=1024):
    """
    Shortcut for workflows: send one prompt, get back plain text.

    Workflow steps don't use tools or keep a conversation going, so they
    don't need the full response object. Each step is a fresh, single
    question, which keeps steps independent and easy to debug.
    """
    resp = llm([{"role": "user", "content": prompt}],
               system=system, max_tokens=max_tokens)
    # Join the text blocks and trim stray whitespace so the result can be
    # compared or passed straight into the next step.
    return "".join(b.text for b in resp.content if b.type == "text").strip()


# =============================================================================
# OpenAI-format providers
#
# Everything below translates between the Claude-style messages the chapters
# use and OpenAI's format, in both directions. You don't need to read this to
# follow the tutorial.
# =============================================================================

class _Content(list):
    """
    A reply's content blocks, plus the provider's original message.

    Some providers attach extra data to their replies (Gemini's "thought
    signatures", DeepSeek's reasoning) that must be sent back unchanged on
    the next turn, so the original is kept alongside the converted blocks.
    """
    openai_message = None


# Keys worth sending back from a provider's reply; everything else is dropped.
_KEEP_KEYS = {"role", "content", "tool_calls", "reasoning_content", "extra_content"}


def _openai_style_llm(messages, tools, system):
    kwargs = {"model": MODEL, "messages": _to_openai_messages(messages, system)}
    if tools:
        kwargs["tools"] = [{"type": "function",
                            "function": {"name": t["name"],
                                         "description": t["description"],
                                         "parameters": t["input_schema"]}}
                           for t in tools]

    # No length limit is sent: newer reasoning models count their thinking
    # towards it, so a small limit can leave them with no room to answer.
    # Set MAX_TOKENS= in .env if you want one.
    if os.getenv("MAX_TOKENS"):
        kwargs["max_tokens"] = int(os.getenv("MAX_TOKENS"))

    resp = client.chat.completions.create(**kwargs)
    return _to_claude_shape(resp)


def _to_openai_messages(messages, system):
    """Claude-style conversation -> OpenAI-style conversation."""
    out = [{"role": "system", "content": system}] if system else []

    for message in messages:
        role, content = message["role"], message["content"]

        if isinstance(content, str):
            out.append({"role": role, "content": content})

        elif role == "assistant":
            # Replay the provider's own message if we kept it (see _Content).
            original = getattr(content, "openai_message", None)
            if original:
                out.append(original)
                continue
            text = "".join(b.text for b in content if b.type == "text")
            calls = [{"id": b.id, "type": "function",
                      "function": {"name": b.name, "arguments": json.dumps(b.input)}}
                     for b in content if b.type == "tool_use"]
            msg = {"role": "assistant", "content": text or None}
            if calls:
                msg["tool_calls"] = calls
            out.append(msg)

        else:
            # A user message holding tool results: OpenAI wants one "tool"
            # message per result instead of a single combined message.
            for block in content:
                if block.get("type") == "tool_result":
                    result = block["content"]
                    out.append({"role": "tool", "tool_call_id": block["tool_use_id"],
                                "content": result if isinstance(result, str) else json.dumps(result)})
                elif block.get("type") == "text":
                    out.append({"role": "user", "content": block["text"]})
    return out


def _to_claude_shape(resp):
    """OpenAI-style reply -> Claude-style reply (.stop_reason + .content blocks)."""
    choice = resp.choices[0]
    msg = choice.message

    original = {k: v for k, v in msg.model_dump(exclude_none=True).items() if k in _KEEP_KEYS}
    blocks = _Content()

    if msg.content:
        blocks.append(SimpleNamespace(type="text", text=msg.content))

    for i, call in enumerate(msg.tool_calls or []):
        # A few providers leave out call IDs; make one so results can be matched.
        call_id = call.id or f"call_{i}"
        if not call.id:
            original["tool_calls"][i]["id"] = call_id
        try:
            args = json.loads(call.function.arguments or "{}")
        except json.JSONDecodeError:
            args = {}
        blocks.append(SimpleNamespace(type="tool_use", id=call_id,
                                      name=call.function.name, input=args))

    blocks.openai_message = original

    if msg.tool_calls:
        stop_reason = "tool_use"
    elif choice.finish_reason == "length":
        stop_reason = "max_tokens"
    else:
        stop_reason = "end_turn"

    return SimpleNamespace(stop_reason=stop_reason, content=blocks,
                           usage=resp.usage, model=resp.model)
