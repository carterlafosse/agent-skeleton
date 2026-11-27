# Agent Skeleton

A barebones, copy-paste skeleton for building AI agents and workflows from scratch. Plug in your own tools and go.

## Chapters

| Chapter | Topic |
|---|---|
| [01](01-single-call/) | Single tool call |
| [02](02-agent-loop/) | Agent loop |
| [03](03-workflows/) | Workflows |
| 04 | Multi-agent *(coming soon)* |
| 05 | Visualizer *(coming soon)* |

Each chapter builds on the last. Start at 01 and work through in order.

## Quickstart

1. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\Activate.ps1      # Windows
   source .venv/bin/activate       # Mac/Linux
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and add your Anthropic API key.
4. Run the first chapter:
   ```bash
   python 01-single-call/single_call.py
   ```

## Use any AI provider

Set `PROVIDER=` in `.env` and add that provider's key. Every chapter works with all of them.

| `PROVIDER=` | Service | Key in `.env` |
|---|---|---|
| `anthropic` | Claude (default) | `ANTHROPIC_API_KEY` |
| `openai` | ChatGPT models | `OPENAI_API_KEY` |
| `gemini` | Google Gemini | `GEMINI_API_KEY` |
| `deepseek` | DeepSeek | `DEEPSEEK_API_KEY` |
| `grok` | xAI Grok | `XAI_API_KEY` |
| `github` | GitHub Models (free tier; closest to a Copilot API) | `GITHUB_TOKEN` |
| `openrouter` | Hundreds of models with one key | `OPENROUTER_API_KEY` |
| `ollama` | Models running on your own computer | none |

Add `MODEL=` to pick a specific model, or `BASE_URL=` for any other OpenAI-compatible service. It all lives in `shared/llm.py`: Claude is called directly, and every other provider goes through OpenAI's API format, with replies converted so the chapters never need to know which one is in use.

## Make it yours

All tools live in `shared/tools.py`. Write a function, put `@tool(...)` above it, and every chapter can use it.