/*
 * App
 *
 * The dashboard page. The graph (you -> lead -> workers -> tools) fills the
 * screen. A slim header holds the run stats, replay controls, speed, and the
 * Panels menu, plus New run / Stop. A closable, resizable, tabbed sidebar on
 * the right shows live events, the lead's summary report, or the selected
 * worker. Workers waiting for approval show Approve / Deny on their node.
 * Pop-ups announce when a run finishes, stops or fails.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import useAgentEvents, { elapsedMs } from './useAgentEvents';
import useNow from './useNow';
import AgentNode from './components/AgentNode/AgentNode';
import PulseEdge from './components/PulseEdge/PulseEdge';
import PanelMenu from './components/PanelMenu/PanelMenu';
import Sidebar from './components/Sidebar/Sidebar';
import EventFeed from './components/EventFeed/EventFeed';
import SummaryPanel from './components/SummaryPanel/SummaryPanel';
import WorkerPanel from './components/WorkerPanel/WorkerPanel';
import Toast from './components/Toast/Toast';
import RunComposer from './components/RunComposer/RunComposer';
import styles from './App.module.css';

// Custom node and edge types. Defined outside the component so React Flow
// doesn't see "new" types on every render.
const nodeTypes = { agent: AgentNode };
const edgeTypes = { pulse: PulseEdge };

const NODE_WIDTH = 250;
const WORKER_SPACING = 290;
const BURST_MS = 1400; // how long the worker -> tools pulse lasts after a call
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const LEAD_LABELS = {
  idle: 'Waiting for a run',
  planning: 'Planning tasks',
  delegating: 'Workers running',
  summarising: 'Writing summary',
  done: 'Run complete',
  stopped: 'Run stopped',
  failed: 'Run failed',
};

const DEFAULT_GOAL = 'Get me organised for moving apartments next month. '
  + 'Break each part into several concrete to-do items. I\'ve already paid rent, so mark that as done.';

// mm:ss for the run timer.
function formatElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Graph: lives inside ReactFlowProvider so it can control the camera.
// ---------------------------------------------------------------------------
function Graph({ nodes, edges, onNodeClick, layoutKey }) {
  // ---- State ----
  const { fitView } = useReactFlow();

  // React Flow measures each node's size after it renders. The graph is
  // rebuilt several times a second for the animations, so keep those
  // measurements between rebuilds; otherwise nodes flicker or go invisible.
  const [flowNodes, setFlowNodes] = useState(nodes);

  useEffect(() => {
    setFlowNodes((previous) => {
      const measured = new Map(previous.map((n) => [n.id, n.measured]));
      return nodes.map((n) => ({ ...n, measured: measured.get(n.id) }));
    });
  }, [nodes]);

  // ---- Data ----
  const nodeCount = nodes.length;

  // Re-centre the camera when nodes are added or the sidebar opens/closes.
  // A second pass catches nodes that grew after their first measurement.
  useEffect(() => {
    const fit = () => fitView({ padding: 0.16, duration: 500, maxZoom: 1.25 });
    const first = setTimeout(fit, 100);
    const second = setTimeout(fit, 700);
    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [nodeCount, layoutKey, fitView]);

  // ---- Handlers ----
  // Lets React Flow store measurements. In React Flow 13 the changes object
  // applies itself with applyTo().
  const handleNodesChange = useCallback(
    (changes) => setFlowNodes((current) => changes.applyTo(current)),
    [],
  );

  // ---- Render ----
  return (
    <ReactFlow
      nodes={flowNodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={onNodeClick}
      nodesDraggable={false}
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
      fitView
      fitViewOptions={{ padding: 0.16, maxZoom: 1.25 }}
    >
      <Background color="#222a35" gap={24} size={1.5} />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  );
}

export default function App() {
  // ---- State ----
  const [speed, setSpeed] = useState(1);
  const run = useAgentEvents(speed);
  const now = useNow(250);

  const [tabs, setTabs] = useState(['events']);   // open sidebar tabs, in order
  const [activeTab, setActiveTab] = useState('events');
  const [selectedId, setSelectedId] = useState(null); // worker shown in the worker tab
  const [toast, setToast] = useState(null); // { variant, title, message, action? }
  // Sidebar starts at just over a quarter of the screen; drag its edge to resize.
  const [sidebarWidth, setSidebarWidth] = useState(() => Math.round(window.innerWidth * 0.27));

  // ---- Data ----
  const {
    connected, goal, leadStatus, tasks, events, summary, clock, toolCount, lastTool,
    failure, replay, skipReplay, replaying, canReplay, serverRunning, startRun, stopRun, decide,
  } = run;

  const taskList = Object.values(tasks);
  const doneCount = taskList.filter((t) => t.status === 'done').length;
  const progress = taskList.length ? doneCount / taskList.length : 0;
  const elapsed = elapsedMs(clock, now);
  const selectedTask = tasks[selectedId] ?? null;
  const sidebarOpen = tabs.length > 0;
  const workerTabOpen = tabs.includes('worker') && activeTab === 'worker';
  const waitingCount = taskList.filter((t) => t.approval).length;

  // Pop-ups for how the run ended; cleared when a new run starts.
  useEffect(() => {
    if (leadStatus === 'planning') setToast(null);
    if (leadStatus === 'done') {
      setToast({ variant: 'success', title: 'Lead summary report',
                 message: 'The team has finished. Your report is ready.',
                 action: { label: 'Open report', tab: 'summary' } });
    }
    if (leadStatus === 'stopped') {
      setToast({ variant: 'info', title: 'Run stopped', message: 'You stopped the run. Work done so far is kept.' });
    }
    if (leadStatus === 'failed') {
      setToast({ variant: 'error', title: 'Run failed', message: failure ?? 'Check the server terminal for details.',
                 action: { label: 'Show events', tab: 'events' } });
    }
  }, [leadStatus, failure]);

  // Show any server error (e.g. the server is offline) as an error pop-up.
  const showError = useCallback((err) => {
    setToast({ variant: 'error', title: 'Something went wrong', message: err.message });
  }, []);

  // Build the graph from the run state. Layout is simple maths: you, the lead
  // and the tools centred, workers spread evenly in a row in the middle.
  const { nodes, edges } = useMemo(() => {
    const list = Object.values(tasks);
    const firstX = -((list.length - 1) * WORKER_SPACING) / 2;
    const leadThinking = leadStatus === 'planning' || leadStatus === 'summarising';
    const toolsActive = lastTool && now - lastTool.at < BURST_MS / speed;

    const nodes = [
      {
        id: 'you',
        type: 'agent',
        position: { x: -NODE_WIDTH / 2, y: 0 },
        data: { variant: 'boss', title: 'You', subtitle: goal ?? 'Press New run to start' },
      },
      {
        id: 'lead',
        type: 'agent',
        position: { x: -NODE_WIDTH / 2, y: 150 },
        data: {
          variant: 'lead',
          title: 'Lead',
          status: { done: 'done', idle: 'pending', stopped: 'stopped', failed: 'stopped' }[leadStatus] ?? 'working',
          activity: leadStatus === 'idle' ? null
            : { kind: leadThinking ? 'thinking' : 'info', text: LEAD_LABELS[leadStatus] },
          badge: list.length ? `${list.filter((t) => t.status === 'done').length}/${list.length} done` : null,
        },
      },
      ...list.map((task, i) => ({
        id: String(task.id),
        type: 'agent',
        position: { x: firstX + i * WORKER_SPACING - NODE_WIDTH / 2, y: 310 },
        selected: workerTabOpen && String(task.id) === String(selectedId),
        data: {
          variant: 'worker',
          title: task.agent ?? `worker-${task.id}`,
          subtitle: task.description,
          // Amber "waiting" while it needs your approval.
          status: task.approval ? 'waiting' : task.status,
          activity: task.activity,
          // Approve / Deny buttons on the node (hidden during replays).
          approval: task.approval && !replaying ? {
            onApprove: () => decide(task.approval.id, 'approved').catch(showError),
            onDeny: () => decide(task.approval.id, 'denied').catch(showError),
          } : null,
          badge: task.steps ? `step ${task.steps}` : null,
          chips: task.log.filter((e) => e.kind === 'tool').slice(-3)
            .map((e) => ({ key: e.at, label: e.tool })),
        },
      })),
      {
        id: 'tools',
        type: 'agent',
        position: { x: -NODE_WIDTH / 2, y: 520 },
        data: {
          variant: 'tools',
          title: 'Tools',
          subtitle: 'Shared to-do list',
          status: toolsActive ? 'working' : 'pending',
          badge: `${toolCount} calls`,
          activity: lastTool ? { kind: 'tool', text: `${lastTool.agent} → ${lastTool.label}` } : null,
          flashKey: lastTool?.at, // changing key restarts the flash animation
        },
      },
    ];

    const edges = [
      { id: 'you-lead', source: 'you', target: 'lead', type: 'pulse',
        data: { speed, mode: leadThinking ? 'flow' : leadStatus === 'done' ? 'done' : 'idle' } },
      ...list.flatMap((task) => [
        { id: `lead-${task.id}`, source: 'lead', target: String(task.id), type: 'pulse',
          data: { speed, mode: task.status === 'working' ? 'flow' : task.status === 'done' ? 'done' : 'idle' } },
        { id: `${task.id}-tools`, source: String(task.id), target: 'tools', type: 'pulse',
          data: { speed, mode: now - task.lastToolAt < BURST_MS / speed ? 'burst' : 'idle' } },
      ]),
    ];

    return { nodes, edges };
  }, [tasks, goal, leadStatus, toolCount, lastTool, selectedId, workerTabOpen, now, speed,
      replaying, decide, showError]);

  // Sidebar tab definitions: label + content for each tab id.
  const tabContent = {
    events: { label: 'Live events', body: <EventFeed events={events} /> },
    summary: { label: 'Lead summary', body: <SummaryPanel summary={summary} goal={goal} /> },
    worker: {
      label: selectedTask?.agent ?? (selectedTask ? `worker-${selectedTask.id}` : 'Worker'),
      body: (
        <WorkerPanel
          task={selectedTask}
          canDecide={!replaying}
          onDecide={(id, decision) => decide(id, decision).catch(showError)}
        />
      ),
    },
  };

  // ---- Handlers ----
  function openTab(id) {
    setTabs((current) => (current.includes(id) ? current : [...current, id]));
    setActiveTab(id);
  }

  function closeTab(id) {
    const remaining = tabs.filter((t) => t !== id);
    setTabs(remaining);
    if (activeTab === id) setActiveTab(remaining[remaining.length - 1] ?? null);
  }

  function handleNodeClick(_event, node) {
    // Only workers have details; they open in the worker tab.
    if (!tasks[node.id]) return;
    setSelectedId(node.id);
    openTab('worker');
  }

  function handleToastAction() {
    if (toast?.action) openTab(toast.action.tab);
    setToast(null);
  }

  function handleStop() {
    stopRun().catch(showError);
  }

  // ---- Render ----
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>Agent Skeleton</h1>
        <span className={connected ? styles.live : styles.offline}>
          <span className={styles.liveDot} />
          {replaying ? 'Replay' : connected ? 'Live' : 'Server offline'}
        </span>
        {goal && <span className={styles.goal} title={goal}>{goal}</span>}

        <div className={styles.controls}>
          {waitingCount > 0 && !replaying && (
            <span className={styles.waiting}>{waitingCount} waiting for approval</span>
          )}
          <span className={styles.stat}>{LEAD_LABELS[leadStatus]}</span>
          <span className={styles.stat}>{toolCount} tool calls</span>
          <span className={styles.timer}>{formatElapsed(elapsed)}</span>

          {replaying ? (
            <button type="button" className={styles.button} onClick={skipReplay}>Skip to end</button>
          ) : (
            <button type="button" className={styles.button} onClick={replay} disabled={!canReplay}
                    title={canReplay ? 'Watch the last run again' : 'Available when a run finishes'}>
              ↻ Replay
            </button>
          )}

          <label className={styles.speed}>
            <span className={styles.srOnly}>Replay speed</span>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className={styles.select}>
              {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
            </select>
          </label>

          {serverRunning ? (
            <button type="button" className={`${styles.button} ${styles.stop}`} onClick={handleStop}>
              ■ Stop
            </button>
          ) : (
            <RunComposer
              defaultGoal={goal ?? DEFAULT_GOAL}
              disabled={!connected}
              onStart={(newGoal, mode) => startRun(newGoal, mode)}
            />
          )}

          <PanelMenu openTabs={tabs} onSelect={openTab} />
        </div>

        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
        </div>
      </header>

      <div className={styles.body}>
        <main className={styles.graph}>
          <ReactFlowProvider>
            <Graph nodes={nodes} edges={edges} onNodeClick={handleNodeClick} layoutKey={sidebarOpen ? sidebarWidth : 0} />
          </ReactFlowProvider>
        </main>

        {sidebarOpen && (
          <Sidebar
            tabs={tabs.map((id) => ({ id, label: tabContent[id].label }))}
            activeTab={activeTab}
            width={sidebarWidth}
            onResize={setSidebarWidth}
            onSelect={setActiveTab}
            onClose={closeTab}
          >
            {tabContent[activeTab]?.body}
          </Sidebar>
        )}
      </div>

      {toast && (
        <Toast
          variant={toast.variant}
          title={toast.title}
          message={toast.message}
          actionLabel={toast.action?.label}
          onAction={handleToastAction}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
