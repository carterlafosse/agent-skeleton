# 04 — Multi-agent

One agent can only hold so much in its head. Here a **lead** splits a goal into tasks, hands each one to a **worker** agent, and combines their results.

The workers share the to-do tools from `shared/tools.py`, so each adds items for its part of the goal, and you end up with one combined list.

## Run it

```bash
python 04-multi-agent/lead.py
```

You'll see the lead's task board, each worker's tool calls as it works, the finished board, and the lead's summary.

## How it works

```
                 You: "Get me organised for moving"
                              │
                            Lead ── plans tasks ──▶ task board
                 ┌────────────┼────────────┐
             worker-1     worker-2     worker-3     (each runs the Chapter 02 loop)
                 └────────────┼────────────┘
                              ▼
                     Lead combines results ──▶ You
```

1. **Plan.** The lead asks the model to split the goal into 2–4 tasks, returned as JSON.
2. **Delegate.** Each task goes to a worker: the agent loop from Chapter 02, given a name and a narrow job.
3. **Track.** `task_list.py` records each task as pending, in progress, then done with its result.
4. **Combine.** The lead reads every result plus the final to-do list and writes one summary.

## Files

| File | Purpose |
|---|---|
| `lead.py` | Plans, delegates and summarises. **Run this one.** |
| `worker.py` | `run_worker()`: the agent loop with a role and the overall goal |
| `task_list.py` | The team's progress board |

## Why it works this way

- **Workers get fresh, focused context.** Each starts with only the goal and its task, not everyone else's history, so it stays on track.
- **Workers know nothing you don't tell them.** They can't see the lead's conversation, so the prompt must include the overall goal and a clear scope ("do ONLY your task").
- **The lead is a workflow, the workers are agents.** Planning and combining are fixed steps (Chapter 03). Each worker decides its own steps (Chapter 02). Most real systems mix both like this.
- **Plans need a fallback.** If the lead's JSON can't be parsed, one worker does the whole goal instead of crashing.
- **Shared data needs care.** By default workers take turns. With `run_team(goal, parallel=True)` they all run at once, which is faster, so `run_tool()` uses a lock to stop two workers changing the to-do list at the same moment.

## Cost

Every worker is its own agent loop, so a team uses several times more API calls than one agent. Use multi-agent when tasks are genuinely separate. For small or step-by-step tasks, one agent (Chapter 02) is cheaper and simpler.

## Make it yours

- Change the goal at the bottom of `lead.py`.
- Give workers different tools or system prompts for different roles (e.g. a researcher and a writer).
- Pass `parallel=True` to `run_team()` to run every worker at the same time.

➡️ **Next: [05 — Visualizer](../05-visualizer/)**: watch the team work as a live graph.
