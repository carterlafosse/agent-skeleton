/*
 * WorkerPanel
 *
 * The worker sidebar tab, opened by clicking a worker in the graph: what
 * it's doing right now, its task, a live timeline of everything it has
 * done, and its final result.
 */

import styles from './WorkerPanel.module.css';

const KIND_LABELS = {
  start: 'start',
  thinking: 'think',
  tool: 'tool',
  result: 'result',
  done: 'done',
};

export default function WorkerPanel({ task }) {
  // ---- Render ----
  if (!task) {
    return <p className={styles.hint}>Click a worker in the graph to follow it here.</p>;
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>{task.agent ?? `worker-${task.id}`}</h2>
      <span className={`${styles.status} ${styles[task.status]}`}>{task.status}</span>

      {task.activity && task.status !== 'done' && (
        <div key={task.activity.text} className={styles.now}>
          <span className={styles.nowLabel}>Right now</span>
          {task.activity.text}
        </div>
      )}

      <h3 className={styles.subheading}>Task</h3>
      <p className={styles.text}>{task.description}</p>

      <h3 className={styles.subheading}>Timeline ({task.log.length})</h3>
      <ol className={styles.timeline}>
        {task.log.map((entry, i) => (
          <li key={i} className={`${styles.entry} ${styles[entry.kind]}`}>
            <span className={styles.kind}>{KIND_LABELS[entry.kind]}</span>
            <span className={styles.entryText}>{entry.text}</span>
          </li>
        ))}
      </ol>

      {task.result && (
        <>
          <h3 className={styles.subheading}>Result</h3>
          <p className={styles.text}>{task.result}</p>
        </>
      )}
    </div>
  );
}
