# Agent Skeleton

A barebones, copy-paste skeleton for building AI agents and workflows from scratch. Plug in your own tools and go.

## Chapters

| Chapter | Topic |
|---|---|
| [01](01-single-call/) | Single tool call |
| [02](02-agent-loop/) | Agent loop |
| 03 | Workflows *(coming soon)* |
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

## Make it yours

All tools live in `shared/tools.py`. Write a function, put `@tool(...)` above it, and every chapter can use it.