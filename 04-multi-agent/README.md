# 04 — Multi-agent

One agent can only hold so much in its head. Here a **lead** splits a goal into tasks, hands each one to a **worker** agent, and combines their results.

The workers share the to-do tools from `shared/tools.py`, so each adds items for its part of the goal, and you end up with one combined list.

## Run it

```bash
python 04-multi-agent/lead.py
```

Example output (trimmed; the lead plans differently each run):

```
Goal: Get me organised for moving apartments next month.

Task board:
  1. [pending] Logistics and movers
  2. [pending] Packing and decluttering
  3. [pending] Admin and address changes
  4. [pending] New apartment preparation

[worker-1] starting: Logistics and movers
  [worker-1] list_todos({})
  [worker-1] add_todo({'text': 'Get at least 3 written quotes from movers'})
  [worker-1] add_todo({'text': 'Book move date and mover; get confirmation in writing'})
  ...

[worker-3] starting: Admin and address changes
  [worker-3] add_todo({'text': 'Give written notice to current landlord'})
  [worker-3] add_todo({'text': 'Set up utilities and internet at new place'})
  ...

Task board:
  1. [done] Logistics and movers
  ...

=== Lead summary ===
The team built a moving to-do list (nothing is booked yet; there are no
booking tools). Your list now has 23 items across logistics, packing,
admin, and new-apartment prep. Start with getting quotes and booking the
move date, since most other tasks depend on it.
```

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
- **Shared data needs care.** Workers run one after another here. Running them at the same time is faster, but two workers changing the same data at once can clash.

## Cost

Every worker is its own agent loop, so a team uses several times more API calls than one agent. Use multi-agent when tasks are genuinely separate. For small or step-by-step tasks, one agent (Chapter 02) is cheaper and simpler.

## Make it yours

- Change the goal at the bottom of `lead.py`.
- Give workers different tools or system prompts for different roles (e.g. a researcher and a writer).
- Swap the `for` loop in `run_team()` for a thread pool to run workers at the same time.

➡️ **Next: [05 — Visualizer](../05-visualizer/)**: watch the team work as a live graph.