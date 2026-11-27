/*
 * AgentNode
 *
 * One box in the graph: you, the lead, a worker, or the shared tools.
 * Shows a status icon, a name, a live "what it's doing right now" line,
 * and chips for the tools it used most recently. Changes animate in.
 * Workers waiting for approval also show Approve / Deny buttons.
 */

import { Handle, Position } from '@xyflow/react';
import styles from './AgentNode.module.css';

// Small animated "..." for when an agent is thinking.
function ThinkingDots() {
  return (
    <span className={styles.dots} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

// Spinner while working, tick when done, hollow ring while waiting.
function StatusIcon({ status }) {
  if (status === 'working') return <span className={styles.spinner} aria-label="working" />;
  if (status === 'done') return <span className={styles.tick} aria-label="done">✓</span>;
  if (status === 'waiting') return <span className={styles.pause} aria-label="waiting for approval">!</span>;
  if (status === 'stopped') return <span className={styles.stopIcon} aria-label="stopped" />;
  return <span className={styles.ring} aria-label="waiting" />;
}

export default function AgentNode({ data, selected }) {
  // ---- Data ----
  const { variant, title, subtitle, status, activity, badge, chips, flashKey, approval } = data;
  const classes = [
    styles.node,
    styles[variant],
    styles[status] ?? '',
    selected ? styles.selected : '',
  ].join(' ');

  // ---- Render ----
  return (
    <div className={classes}>
      <Handle type="target" position={Position.Top} className={styles.handle} />

      {/* Re-keying on flashKey replays the flash animation (Tools node). */}
      <div key={flashKey ?? 'static'} className={flashKey ? styles.flash : undefined}>
        <div className={styles.header}>
          {variant !== 'boss' && <StatusIcon status={status} />}
          <span className={styles.title}>{title}</span>
          {badge && <span className={styles.badge}>{badge}</span>}
        </div>

        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

        {/* Keyed by text so each new activity fades in. */}
        {activity && (
          <div key={activity.text} className={`${styles.activity} ${styles[activity.kind] ?? ''}`}>
            {activity.kind === 'thinking' && <ThinkingDots />}
            <span className={styles.activityText}>{activity.text}</span>
          </div>
        )}

        {chips?.length > 0 && (
          <div className={styles.chips}>
            {chips.map((chip) => (
              <span key={chip.key} className={styles.chip}>{chip.label}</span>
            ))}
          </div>
        )}
      </div>

      {/* stopPropagation so clicking a button doesn't also select the node. */}
      {approval && (
        <div className={styles.approval}>
          <button type="button" className={styles.approve}
                  onClick={(e) => { e.stopPropagation(); approval.onApprove(); }}>
            Approve
          </button>
          <button type="button" className={styles.deny}
                  onClick={(e) => { e.stopPropagation(); approval.onDeny(); }}>
            Deny
          </button>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
}
