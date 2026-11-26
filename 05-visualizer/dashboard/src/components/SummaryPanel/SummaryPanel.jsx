/*
 * SummaryPanel
 *
 * The "Lead summary" sidebar tab: the lead's final report for the run.
 * The model writes light Markdown (**bold** and "- " bullets), so this
 * renders just those two things without needing a Markdown library.
 */

import styles from './SummaryPanel.module.css';

// Turn **bold** inside a line into <strong>.
function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part,
  );
}

// Group lines into paragraphs and bullet lists.
function renderReport(summary) {
  const blocks = [];
  let bullets = [];

  const flushBullets = () => {
    if (bullets.length) {
      blocks.push(<ul key={blocks.length} className={styles.bullets}>{bullets}</ul>);
      bullets = [];
    }
  };

  summary.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return flushBullets();
    if (line.startsWith('- ') || line.startsWith('* ')) {
      bullets.push(<li key={i}>{renderInline(line.slice(2))}</li>);
    } else {
      flushBullets();
      blocks.push(<p key={blocks.length} className={styles.paragraph}>{renderInline(line)}</p>);
    }
  });
  flushBullets();
  return blocks;
}

export default function SummaryPanel({ summary, goal }) {
  // ---- Render ----
  if (!summary) {
    return <p className={styles.empty}>No report yet. It appears here when the team finishes.</p>;
  }

  return (
    <article className={styles.report}>
      <span className={styles.label}>Lead summary report</span>
      {goal && <h2 className={styles.goal}>{goal}</h2>}
      {renderReport(summary)}
    </article>
  );
}
