# 05 — Visualizer

Watch the Chapter 04 team work as a live graph. Workers run at the same time, particles flow along the connections while they work, each node shows what its agent is doing right now (thinking, calling a tool, reading a result), and a purple burst shoots to the Tools node on every tool call.

## How it works

```
Python agents ──emit()──▶ Node server ──WebSocket──▶ React dashboard
 (lead, workers)          (port 4000)                (React Flow graph)
```

1. **The agents report in.** `shared/emit.py` sends a small JSON event at each step: the lead's status, a worker thinking, a tool call and its result, a task finishing.
2. **The server forwards.** `server/server.js` receives each event and pushes it to every open dashboard.
3. **The dashboard draws.** `useAgentEvents.js` turns the events into state, and React Flow draws it as a graph.

The agents don't know or care whether the dashboard is running. If the server is off, `emit()` switches itself off and everything works as before.

## Setup (once)

You need [Node.js](https://nodejs.org) installed.

**Server:**
```bash
cd 05-visualizer/server
npm install
```

**Dashboard:**
```bash
cd 05-visualizer/dashboard
npm install
```

## Run it

Use three terminals, all starting from the project root:

| Terminal | Command | What it does |
|---|---|---|
| 1 | `cd 05-visualizer/server` then `npm start` | Starts the event server |
| 2 | `cd 05-visualizer/dashboard` then `npm run dev` | Starts the dashboard. Open the URL it prints (usually http://localhost:5173) |
| 3 | Optional: `python main.py` (with `.venv` active) | Runs the team from a terminal instead of the dashboard |

Start a run with **▶ New run** in the dashboard (the server runs `main.py` for you), or run `python main.py "your goal"` in a terminal. Either way the team runs with `parallel=True`, so every worker lights up at once.

## Using the dashboard

- **The graph fills the screen.** The camera re-fits whenever nodes appear or the sidebar changes size.
- **Sidebar tabs (right).** Live events, the lead's summary report, and the worker you clicked. Each tab has an **×**; close them all and the graph takes the whole screen. Drag the sidebar's left edge to resize it.
- **Panels menu (top right).** Reopen Live events or Lead summary at any time.
- **Summary pop-up.** When a run finishes, a card appears top right. **Open report** opens the summary tab.
- **New run / Stop.** Type a goal, choose what needs your approval, and start the team. **■ Stop** ends a dashboard-started run; work done so far is kept.
- **Approvals.** Tools marked `risky=True` in `shared/tools.py` (like `complete_todo`) pause the worker: its node turns amber with **Approve / Deny** buttons. A denial goes back to the model as a normal result, so it carries on without that action. With nobody answering, it's denied after 5 minutes. Choose "Every tool call" to approve everything, or "Off" to run freely.
- **Replay.** After a run, **↻ Replay** plays it back with the original timing. **Skip to end** jumps to the finish.
- **Speed.** The dropdown (0.25× to 2×) sets replay speed, including the particle animations. Live runs always go at the API's real speed.

## Hosted demo (no setup for visitors)

The dashboard has a **demo mode** that needs no server: it replays a recorded run from `dashboard/public/demo-run.json`. The workflow in `.github/workflows/deploy-demo.yml` builds it in demo mode and publishes it to GitHub Pages on every push to `main`.

To make or refresh the demo:
1. Do a real run from the dashboard, then click **⤓ Save run**. This downloads `demo-run.json`.
2. Move it into `05-visualizer/dashboard/public/`.
3. Check it locally at `http://localhost:5173/?demo` (works with the server off).
4. Commit and push. The site updates in a minute or two.

One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

## The event contract

The agents and dashboard only agree on these events. Anything that sends them can be visualised.

| Event | Sent by | Fields |
|---|---|---|
| `run_started` | lead | `goal` |
| `lead_status` | lead | `status`: `delegating` or `summarising` |
| `task_added` | task list | `task_id`, `description` |
| `task_started` | task list | `task_id`, `agent` |
| `agent_thinking` | worker | `agent`, `step` |
| `tool_call` | worker | `agent`, `tool`, `args` |
| `tool_result` | worker | `agent`, `tool`, `preview` |
| `approval_requested` | worker | `approval_id`, `agent`, `tool`, `args` |
| `approval_resolved` | server | `approval_id`, `agent`, `decision` |
| `task_done` | task list | `task_id`, `agent`, `result` |
| `run_done` | lead | `summary` |
| `run_stopped` | server | (none) |
| `run_failed` | server | `message` |

Every event also has `type` and `ts` (timestamp).

## Files

| File | Purpose |
|---|---|
| `../shared/emit.py` | Sends events from Python. Switches off quietly if the server isn't running |
| `../shared/approval.py` | Asks the dashboard before risky tool calls; denies if nobody answers |
| `server/server.js` | Receives events and broadcasts them, replays the current run to late-opened dashboards, starts and stops runs, and relays approvals |
| `dashboard/src/useAgentEvents.js` | WebSocket connection, reducer that turns events into state, and run recording for replays |
| `dashboard/src/App.jsx` | Page layout; builds graph nodes and edges from state, keeps the camera fitted |
| `dashboard/src/useNow.js` | A ticking clock for the run timer and short animations |
| `dashboard/src/components/AgentNode/` | One box in the graph: status icon, live activity line, tool chips |
| `dashboard/src/components/PulseEdge/` | Connection lines with moving particles |
| `dashboard/src/components/Sidebar/` | Resizable right-hand panel with closable tabs |
| `dashboard/src/components/EventFeed/` | Live events tab |
| `dashboard/src/components/SummaryPanel/` | Lead summary tab (renders the report's bold text and bullets) |
| `dashboard/src/components/WorkerPanel/` | Worker tab: live status and timeline for the clicked worker |
| `dashboard/src/components/PanelMenu/` | The Panels dropdown |
| `dashboard/src/components/Toast/` | Pop-ups: summary ready, run stopped, run failed |
| `dashboard/src/components/RunComposer/` | The New run button and goal form |

## Why it works this way

- **Your own events, not someone else's files.** You control both ends, so nothing breaks unless you change it. Reading another tool's internal files would break whenever that tool updates.
- **Observability is designed in.** Five `emit()` calls turn a black box into something you can watch and debug. The same events could feed logs or metrics.
- **The contract is the boundary.** Python doesn't know about React, and React doesn't know about Python. To visualise a different system, make it send the same events.
- **Fail-safe by default.** A missing dashboard never crashes or slows the agents.

## Make it yours

- Add `emit()` calls to Chapter 02's loop to watch a single agent.
- Add a new event type: send it from Python, then handle it in the reducer in `useAgentEvents.js`.
- Change the look in the `.module.css` files, or colours in `index.css`.
