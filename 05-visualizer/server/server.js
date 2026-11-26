/*
 * Visualizer server
 *
 * Receives events from the Python agents (POST /events) and forwards each
 * one to every open dashboard over a WebSocket, so the graph updates live.
 *
 * It also remembers the current run's events, so a dashboard opened halfway
 * through a run catches up instead of starting blank.
 *
 * Run:  npm start   (from 05-visualizer/server)
 */

const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = 4000;

const app = express();
app.use(express.json());

// Every event from the current run. Cleared when a new run starts.
let history = [];

app.post('/events', (req, res) => {
  const event = req.body;

  if (event.type === 'run_started') history = [];
  history.push(event);

  // Forward to every connected dashboard. readyState 1 means "open".
  const message = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(message);
  });

  res.sendStatus(204); // received, nothing to send back
});

// One port for both: HTTP for the agents, WebSocket for the dashboard.
const server = app.listen(PORT, () => {
  console.log(`Visualizer server on http://localhost:${PORT}`);
});
const wss = new WebSocketServer({ server });

// A newly opened dashboard gets the current run's history first.
wss.on('connection', (socket) => {
  history.forEach((event) => socket.send(JSON.stringify(event)));
});
