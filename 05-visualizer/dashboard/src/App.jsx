/*
 * App
 *
 * The dashboard page. The graph (you -> lead -> workers -> tools) fills the
 * screen. A slim header holds the run stats, replay controls, speed, and the
 * Panels menu. A closable, resizable, tabbed sidebar on the right shows live events,
 * the lead's summary report, or the selected worker. When the run finishes,
 * a pop-up offers to open the summary report.
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
};

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
  const [showToast, setShowToast] = useState(false);
  // Sidebar starts at just over a quarter of the screen; drag its edge to resize.
  const [sidebarWidth, setSidebarWidth] = useState(() => Math.round(window.innerWidth * 0.27));

  // ---- Data ----
  const {
    connected, goal, leadStatus, tasks, events, summary, clock, toolCount, lastTool,
    replay, skipReplay, replaying, canReplay,
  } = run;

  const taskList = Object.values(tasks);
  const doneCount = taskList.filter((t) => t.status === 'done').length;
  const progress = taskList.length ? doneCount / taskList.length : 0;
  const elapsed = elapsedMs(clock, now);
  const selectedTask = tasks[selectedId] ?? null;
  const sidebarOpen = tabs.length > 0;
  const workerTabOpen = tabs.includes('worker') && activeTab === 'worker';

  // Pop up the summary report when a run (or replay) finishes; hide it when a
  // new one starts.
  useEffect(() => {
    if (leadStatus === 'done') setShowToast(true);
    if (leadStatus === 'planning') setShowToast(false);
  }, [leadStatus]);

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
        data: { variant: 'boss', title: 'You', subtitle: goal ?? 'Run python main.py to start' },
      },
      {
        id: 'lead',
        type: 'agent',
        position: { x: -NODE_WIDTH / 2, y: 150 },
        data: {
          variant: 'lead',
          title: 'Lead',
          status: leadStatus === 'done' ? 'done' : leadStatus === 'idle' ? 'pending' : 'working',
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
          status: task.status,
          activity: task.activity,
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
  }, [tasks, goal, leadStatus, toolCount, lastTool, selectedId, workerTabOpen, now, speed]);

  // Sidebar tab definitions: label + content for each tab id.
  const tabContent = {
    events: { label: 'Live events', body: <EventFeed events={events} /> },
    summary: { label: 'Lead summary', body: <SummaryPanel summary={summary} goal={goal} /> },
    worker: {
      label: selectedTask?.agent ?? (selectedTask ? `worker-${selectedTask.id}` : 'Worker'),
      body: <WorkerPanel task={selectedTask} />,
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

  function handleOpenReport() {
    setShowToast(false);
    openTab('summary');
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

      {showToast && summary && (
        <Toast
          title="Lead summary report"
          message="The team has finished. Your report is ready."
          actionLabel="Open report"
          onAction={handleOpenReport}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}
