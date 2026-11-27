/*
 * Visualizer server
 *
 * - Receives events from the Python agents (POST /events) and forwards each
 *   one to every open dashboard over a WebSocket, so the graph updates live.
 * - Remembers the current run's events, so a dashboard opened halfway
 *   through a run catches up instead of starting blank.
 * - Starts and stops runs for the dashboard (POST /run, POST /stop) by
 *   running main.py from the project root.
 * - Passes approvals between agents and the dashboard: agents ask
 *   (approval_requested event), the dashboard answers (POST /approvals/:id),
 *   and agents check the answer (GET /approvals/:id).
 *
 * Run:  npm start   (from 05-visualizer/server)
 */

const express = require('express');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 4000;
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const app = express();
app.use(express.json());

// Allow the dashboard (a different port) to call this server.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---- State ----

let history = [];           // every event of the current run
const approvals = new Map(); // approval_id -> { status, agent }
let child = null;            // the running main.py process, if we started one
let stoppedByUser = false;
let errorTail = '';          // last bit of Python's error output, for failure messages

// ---- Helpers ----

// Send an event to every dashboard. Recorded events also go into history.
function broadcast(event, record = true) {
  if (record) {
    if (event.type === 'run_started') history = [];
    history.push(event);
  }
  const message = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(message);
  });
}

// Tell dashboards whether a dashboard-started run is in progress.
// Not recorded: it's a status update, not part of the run.
function sendStatus() {
  broadcast({ type: '_server', running: Boolean(child) }, false);
}

const now = () => Date.now() / 1000;

// Prefer the project's virtual environment so the right packages are used.
function findPython() {
  const candidates = process.platform === 'win32'
    ? [path.join(PROJECT_ROOT, '.venv', 'Scripts', 'python.exe')]
    : [path.join(PROJECT_ROOT, '.venv', 'bin', 'python')];
  return candidates.find((p) => fs.existsSync(p))
    ?? (process.platform === 'win32' ? 'python' : 'python3');
}

// ---- Events from agents ----

app.post('/events', (req, res) => {
  const event = req.body;
  if (event.type === 'approval_requested') {
    approvals.set(event.approval_id, { status: 'pending', agent: event.agent });
  }
  broadcast(event);
  res.sendStatus(204);
});

// ---- Approvals ----

// Agents poll this until it says approved or denied.
app.get('/approvals/:id', (req, res) => {
  res.json({ status: approvals.get(req.params.id)?.status ?? 'pending' });
});

// The dashboard answers here.
app.post('/approvals/:id', (req, res) => {
  const approval = approvals.get(req.params.id);
  const { decision } = req.body;
  if (!approval) return res.status(404).json({ error: 'Unknown approval' });
  if (!['approved', 'denied'].includes(decision)) return res.status(400).json({ error: 'Bad decision' });
  if (approval.status !== 'pending') return res.status(409).json({ error: 'Already decided' });

  approval.status = decision;
  broadcast({ type: 'approval_resolved', ts: now(), approval_id: req.params.id,
              agent: approval.agent, decision });
  res.sendStatus(204);
});

// ---- Starting and stopping runs ----

app.post('/run', (req, res) => {
  if (child) return res.status(409).json({ error: 'A run is already in progress' });

  const goal = String(req.body.goal ?? '').trim();
  const approvalMode = ['off', 'risky', 'all'].includes(req.body.approvalMode) ? req.body.approvalMode : 'off';
  if (!goal) return res.status(400).json({ error: 'Goal is required' });

  stoppedByUser = false;
  errorTail = '';
  approvals.clear();

  // Arguments are passed as a list (not one command string), so the goal's
  // text can never be run as a shell command.
  child = spawn(findPython(), ['main.py', goal], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, APPROVAL_MODE: approvalMode, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
  });

  // Show the agents' output in this terminal, to help with debugging.
  child.stdout.on('data', (data) => process.stdout.write(`[agents] ${data}`));
  child.stderr.on('data', (data) => {
    process.stderr.write(`[agents] ${data}`);
    errorTail = (errorTail + data).slice(-800);
  });

  child.on('error', (err) => {
    broadcast({ type: 'run_failed', ts: now(), message: `Couldn't start Python: ${err.message}` });
  });

  child.on('exit', (code) => {
    const wasStopped = stoppedByUser;
    child = null;
    if (wasStopped) {
      broadcast({ type: 'run_stopped', ts: now() });
    } else if (code !== 0) {
      broadcast({ type: 'run_failed', ts: now(),
                  message: errorTail.trim().split('\n').slice(-4).join('\n') || `Exited with code ${code}` });
    }
    sendStatus();
  });

  sendStatus();
  res.status(202).json({ started: true });
});

app.post('/stop', (req, res) => {
  if (!child) return res.status(409).json({ error: 'No dashboard-started run to stop' });
  stoppedByUser = true;
  // On Windows a venv's python.exe is a launcher that starts a second
  // process, so end the whole process tree (/T); elsewhere a normal kill works.
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  } else {
    child.kill();
  }
  res.sendStatus(202);
});

// ---- Start ----

// One port for both: HTTP for the agents, WebSocket for the dashboard.
const server = app.listen(PORT, () => {
  console.log(`Visualizer server on http://localhost:${PORT}`);
  console.log(`Runs will use: ${findPython()}`);
});
const wss = new WebSocketServer({ server });

// A newly opened dashboard gets the run status, then the current run's history.
wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: '_server', running: Boolean(child) }));
  history.forEach((event) => socket.send(JSON.stringify(event)));
});
