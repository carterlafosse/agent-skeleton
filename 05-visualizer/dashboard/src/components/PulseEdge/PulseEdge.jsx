/*
 * PulseEdge
 *
 * A connection line between two nodes that can show movement:
 *   idle   dim line
 *   flow   particles stream along it (work in progress)
 *   burst  one fast bright particle (a tool was just called)
 *   done   solid green line
 */

import { getBezierPath } from '@xyflow/react';
import styles from './PulseEdge.module.css';

export default function PulseEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) {
  // ---- Data ----
  const mode = data?.mode ?? 'idle';
  const speed = data?.speed ?? 1; // replay speed also speeds up the particles
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const flowDur = 1.6 / speed;

  // ---- Render ----
  return (
    <g>
      <path d={path} className={`${styles.line} ${styles[mode]}`} fill="none" />

      {/* Particles travel along the same path using SVG animateMotion. */}
      {mode === 'flow' && [0, 0.34, 0.68].map((offset) => (
        <circle key={`${offset}-${speed}`} r="3.5" className={styles.particle}>
          <animateMotion dur={`${flowDur}s`} begin={`${offset * flowDur}s`}
                         repeatCount="indefinite" path={path} />
        </circle>
      ))}

      {mode === 'burst' && (
        <circle key={speed} r="5" className={styles.burst}>
          <animateMotion dur={`${0.7 / speed}s`} repeatCount="indefinite" path={path} />
        </circle>
      )}
    </g>
  );
}
