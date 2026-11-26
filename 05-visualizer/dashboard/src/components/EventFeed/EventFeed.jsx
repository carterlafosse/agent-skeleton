/*
 * EventFeed
 *
 * The "Live events" sidebar tab: every event of the run, newest first.
 * New lines slide in, and each event type has its own colour.
 */

import styles from './EventFeed.module.css';

// Turn one raw event into a readable line.
function describe(event) {
  switch (event.type) {
    case 'run_started':    return `Run started: ${event.goal}`;
    case 'lead_status':    return `Lead is ${event.status}`;
    case 'task_added':     return `Task ${event.task_id} added: ${event.description}`;
    case 'task_started':   return `${event.agent} started task ${event.task_id}`;
    case 'agent_thinking': return `${event.agent} thinking (step ${event.step})`;
    case 'tool_call':      return `${event.agent} → ${event.tool}(${JSON.stringify(event.args)})`;
    case 'tool_result':    return `${event.agent} ← ${event.preview}`;
    case 'task_done':      return `${event.agent} finished task ${event.task_id}`;
    case 'run_done':       return 'Run finished, summary ready';
    default:               return event.type;
  }
}

export default function EventFeed({ events }) {
  // ---- Render ----
  if (events.length === 0) {
    return <p className={styles.empty}>No events yet. Run python main.py to start.</p>;
  }

  return (
    <ol className={styles.list}>
      {events.map((event, i) => (
        <li key={`${event.ts}-${event.type}-${events.length - i}`}
            className={`${styles.item} ${styles[event.type] ?? ''}`}>
          {/* Replays keep the original time in origTs. */}
          <span className={styles.time}>
            {new Date((event.origTs ?? event.ts) * 1000).toLocaleTimeString()}
          </span>
          <span className={styles.text}>{describe(event)}</span>
        </li>
      ))}
    </ol>
  );
}
