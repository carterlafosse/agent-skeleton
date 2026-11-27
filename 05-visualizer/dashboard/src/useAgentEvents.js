/*
 * useAgentEvents
 *
 * Connects to the visualizer server and turns the stream of events into one
 * state object the dashboard can draw: the lead's status, each task with its
 * worker's live activity and history, tool-call counts, and the summary.
 *
 * It also records every event of the latest run, so the whole run can be
 * replayed afterwards at any speed, and exposes controls for the server:
 * start a run, stop it, and answer approval requests.
 *
 * Reconnects automatically, so you can start the server after the dashboard.
 *
 * Demo mode (on the hosted GitHub Pages site, or with ?demo in the address):
 * no server at all. It loads a recorded run from demo-run.json and replays it.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

const SERVER_URL = 'ws://localhost:4000';
const HTTP_URL = 'http://localhost:4000';

// Demo mode is switched on by the hosted build (VITE_DEMO=true), or locally
// by adding ?demo to the address, e.g. http://localhost:5173/?demo
export const IS_DEMO = import.meta.env.VITE_DEMO === 'true'
  || new URLSearchParams(window.location.search).has('demo');

// Where the recorded demo run lives (the public/ folder). BASE_URL keeps the
// path right when the site is hosted under /agent-skeleton/ on GitHub Pages.
const DEMO_RUN_URL = `${import.meta.env.BASE_URL}demo-run.json`;

// Long pauses (e.g. the lead planning) are capped during replay so you
// aren't left watching nothing happen.
const MAX_REPLAY_GAP_MS = 3000;

const initialState = {
  connected: false,
  goal: null,
  leadStatus: 'idle',  // idle | planning | delegating | summarising | done | stopped | failed
  tasks: {},           // task_id -> task (see newTask below)
  events: [],          // newest first, capped at 150
  summary: null,
  failure: null,       // error message if the run failed
  clock: null,         // run timer: { base, at, scale } (see elapsedMs below)
  toolCount: 0,        // tool calls across the whole team
  lastTool: null,      // { agent, label, at } for the Tools node
};

// ---- Helpers ----

// Short, readable version of tool arguments: {"text": "Book movers"} -> "Book movers"
function shortArgs(args) {
  const text = Object.values(args ?? {}).map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ');
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
}

function newTask(event) {
  return {
    id: event.task_id,
    description: event.description,
    status: 'pending',   // pending | working | done | stopped
    agent: null,
    steps: 0,
    activity: null,      // what it's doing right now: { kind, text }
    log: [],             // full history for the worker panel
    toolCalls: 0,
    lastToolAt: 0,
    approval: null,      // { id, label } while waiting for a person's decision
    result: null,
  };
}

// Find the task an agent is working on (tool events are reported by agent name).
const taskForAgent = (state, agent) => Object.values(state.tasks).find((t) => t.agent === agent);

// Update one task, adding an entry to its activity log at the same time.
function patchTask(state, taskId, changes, logEntry) {
  const task = state.tasks[taskId];
  if (!task) return state.tasks;
  const log = logEntry ? [...task.log, logEntry] : task.log;
  return { ...state.tasks, [taskId]: { ...task, ...changes, log } };
}

// The run timer is stored as "base ms, plus time since `at`, times `scale`".
// Live runs tick at 1x; replays tick at the chosen speed; `at: null` = stopped.
export function elapsedMs(clock, now) {
  if (!clock) return 0;
  return clock.at === null ? clock.base : clock.base + (now - clock.at) * clock.scale;
}

function nextClock(state, event, at) {
  if (event._replay) {
    // Replayed events carry their original elapsed time and the playback speed.
    return ['run_done', 'run_stopped', 'run_failed'].includes(event.type)
      ? { base: event._elapsed, at: null, scale: 1 }
      : { base: event._elapsed, at: Date.now(), scale: event._speed };
  }
  if (event.type === 'run_started') return { base: 0, at, scale: 1 };
  if (['run_done', 'run_stopped', 'run_failed'].includes(event.type)) {
    return { base: elapsedMs(state.clock, at), at: null, scale: 1 };
  }
  return state.clock;
}

// ---- Reducer: every event goes through here and returns the new state ----

function reducer(state, event) {
  if (event.type === '_connected') return { ...state, connected: true };
  if (event.type === '_disconnected') return { ...state, connected: false };

  const at = event.ts * 1000;
  const events = [event, ...state.events].slice(0, 150);
  const clock = nextClock(state, event, at);

  switch (event.type) {
    case 'run_started':
      return { ...initialState, connected: state.connected, goal: event.goal,
               leadStatus: 'planning', clock, events: [event] };

    case 'lead_status':
      return { ...state, events, clock, leadStatus: event.status };

    case 'task_added':
      return { ...state, events, clock, tasks: { ...state.tasks, [event.task_id]: newTask(event) } };

    case 'task_started':
      return { ...state, events, clock, tasks: patchTask(state, event.task_id,
        { status: 'working', agent: event.agent, activity: { kind: 'thinking', text: 'Reading the task' } },
        { kind: 'start', text: 'Started', at }) };

    case 'agent_thinking': {
      const task = taskForAgent(state, event.agent);
      if (!task) return { ...state, events, clock };
      return { ...state, events, clock, tasks: patchTask(state, task.id,
        { steps: event.step, activity: { kind: 'thinking', text: `Thinking · step ${event.step}` } },
        { kind: 'thinking', text: `Thinking (step ${event.step})`, at }) };
    }

    case 'tool_call': {
      const task = taskForAgent(state, event.agent);
      if (!task) return { ...state, events, clock };
      const label = `${event.tool}(${shortArgs(event.args)})`;
      return {
        ...state,
        events,
        clock,
        toolCount: state.toolCount + 1,
        lastTool: { agent: event.agent, label, at },
        tasks: patchTask(state, task.id,
          { toolCalls: task.toolCalls + 1, lastToolAt: at, activity: { kind: 'tool', text: label } },
          { kind: 'tool', text: label, tool: event.tool, at }),
      };
    }

    case 'tool_result': {
      const task = taskForAgent(state, event.agent);
      if (!task) return { ...state, events, clock };
      return { ...state, events, clock, tasks: patchTask(state, task.id,
        { activity: { kind: 'result', text: event.preview } },
        { kind: 'result', text: event.preview, at }) };
    }

    case 'task_done':
      return { ...state, events, clock, tasks: patchTask(state, event.task_id,
        { status: 'done', result: event.result, activity: { kind: 'done', text: 'Finished' } },
        { kind: 'done', text: 'Finished', at }) };

    case 'approval_requested': {
      const task = taskForAgent(state, event.agent);
      if (!task) return { ...state, events, clock };
      const label = `${event.tool}(${shortArgs(event.args)})`;
      return { ...state, events, clock, tasks: patchTask(state, task.id,
        { approval: { id: event.approval_id, label },
          activity: { kind: 'approval', text: `Needs approval: ${label}` } },
        { kind: 'approval', text: `Asked to run ${label}`, at }) };
    }

    case 'approval_resolved': {
      const task = Object.values(state.tasks).find((t) => t.approval?.id === event.approval_id);
      if (!task) return { ...state, events, clock };
      const approved = event.decision === 'approved';
      return { ...state, events, clock, tasks: patchTask(state, task.id,
        { approval: null,
          activity: { kind: approved ? 'tool' : 'denied', text: `${approved ? 'Approved' : 'Denied'}: ${task.approval.label}` } },
        { kind: approved ? 'approved' : 'denied', text: approved ? 'Approved by you' : 'Denied by you', at }) };
    }

    case 'run_done':
      return { ...state, events, clock, summary: event.summary, leadStatus: 'done' };

    case 'run_stopped':
    case 'run_failed': {
      // Anything still in progress stops where it is.
      const tasks = Object.fromEntries(Object.entries(state.tasks).map(([id, t]) => [id,
        t.status === 'done' ? t : { ...t, status: 'stopped', approval: null,
                                     activity: { kind: 'denied', text: 'Stopped' } }]));
      return { ...state, events, clock, tasks,
               leadStatus: event.type === 'run_stopped' ? 'stopped' : 'failed',
               failure: event.type === 'run_failed' ? event.message : null };
    }

    default:
      return { ...state, events, clock };
  }
}

// A sleep that can be cut short (used by "Skip to end").
function sleep(ms, token) {
  return new Promise((resolve) => {
    token.wake = resolve;
    setTimeout(resolve, ms);
  });
}

export default function useAgentEvents(speed = 1) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [replaying, setReplaying] = useState(false);
  const [canReplay, setCanReplay] = useState(false);
  const [serverRunning, setServerRunning] = useState(false); // a dashboard-started run is going
  const [demoMissing, setDemoMissing] = useState(false);     // demo mode, but no demo-run.json

  const runLog = useRef([]);        // every event of the latest run, in order
  const speedRef = useRef(speed);   // read at each step, so speed changes apply mid-replay
  const replayToken = useRef(null); // lets a running replay be skipped or cancelled

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // ---- Replay: feed the recorded events back in with their original gaps ----
  const replay = useCallback(async () => {
    const log = runLog.current;
    if (!log.length) return;

    const token = { cancelled: false, skip: false, wake: null };
    replayToken.current = token;
    setReplaying(true);

    const start = log[0].ts;
    for (let i = 0; i < log.length; i++) {
      if (i > 0 && !token.skip) {
        const gap = Math.min((log[i].ts - log[i - 1].ts) * 1000, MAX_REPLAY_GAP_MS);
        await sleep(gap / speedRef.current, token);
      }
      if (token.cancelled) return;

      dispatch({
        ...log[i],
        ts: Date.now() / 1000,             // "now", so pulses and bursts animate
        origTs: log[i].ts,                 // original time, for the event list
        _replay: true,
        _elapsed: (log[i].ts - start) * 1000,
        _speed: speedRef.current,
      });
    }
    if (replayToken.current === token) setReplaying(false);
  }, []);

  // Jump straight to the end of a replay.
  const skipReplay = useCallback(() => {
    const token = replayToken.current;
    if (!token) return;
    token.skip = true;
    token.wake?.();
  }, []);

  // ---- Demo mode: load the recorded run and play it ----
  useEffect(() => {
    if (!IS_DEMO) return;
    fetch(DEMO_RUN_URL)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((events) => {
        runLog.current = events;
        setCanReplay(true);
        replay();
      })
      .catch(() => setDemoMissing(true));
  }, [replay]);

  // ---- Live connection (skipped in demo mode: there's no server) ----
  useEffect(() => {
    if (IS_DEMO) return undefined;
    let socket;
    let retryTimer;
    let stopped = false;

    function connect() {
      socket = new WebSocket(SERVER_URL);
      socket.onopen = () => dispatch({ type: '_connected' });
      socket.onmessage = (msg) => {
        const event = JSON.parse(msg.data);

        // Status updates from the server aren't part of the run.
        if (event.type === '_server') {
          setServerRunning(event.running);
          return;
        }

        // Record the run for replays. A new run cancels any replay in progress.
        if (event.type === 'run_started') {
          runLog.current = [event];
          if (replayToken.current) replayToken.current.cancelled = true;
          setReplaying(false);
          setCanReplay(false);
        } else {
          runLog.current.push(event);
        }
        if (['run_done', 'run_stopped', 'run_failed'].includes(event.type)) setCanReplay(true);

        dispatch(event);
      };
      socket.onclose = () => {
        dispatch({ type: '_disconnected' });
        if (!stopped) retryTimer = setTimeout(connect, 2000);
      };
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  // ---- Server controls ----
  // POST to the server; throws with the server's error message on failure.
  const post = useCallback(async (urlPath, body = {}) => {
    const response = await fetch(`${HTTP_URL}${urlPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? `Server error ${response.status}`);
    }
  }, []);

  const startRun = useCallback((goal, approvalMode) => post('/run', { goal, approvalMode }), [post]);
  const stopRun = useCallback(() => post('/stop'), [post]);
  const decide = useCallback((approvalId, decision) => post(`/approvals/${approvalId}`, { decision }), [post]);

  // ---- Save the last run as a file (used to make the hosted demo) ----
  const downloadRun = useCallback(() => {
    const blob = new Blob([JSON.stringify(runLog.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'demo-run.json';
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  return { ...state, replay, skipReplay, replaying, canReplay,
           serverRunning, startRun, stopRun, decide, downloadRun, demoMissing };
}
