/*
 * RunComposer
 *
 * The "New run" button and its pop-over form: type a goal, choose which
 * actions need your approval, and start the team. The server runs main.py
 * with that goal.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './RunComposer.module.css';

const APPROVAL_MODES = [
  { value: 'risky', label: 'Risky actions only' },
  { value: 'all', label: 'Every tool call' },
  { value: 'off', label: 'Off (run freely)' },
];

export default function RunComposer({ defaultGoal, disabled, onStart }) {
  // ---- State ----
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState(defaultGoal);
  const [mode, setMode] = useState('risky');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const boxRef = useRef(null);

  // ---- Data ----
  // Close when clicking anywhere outside the pop-over.
  useEffect(() => {
    if (!open) return;
    function handleOutside(event) {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // ---- Handlers ----
  function handleToggle() {
    if (!open) {
      setGoal((current) => current || defaultGoal);
      setError(null);
    }
    setOpen(!open);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStarting(true);
    setError(null);
    try {
      await onStart(goal.trim(), mode);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  // ---- Render ----
  return (
    <div className={styles.composer} ref={boxRef}>
      <button type="button" className={styles.trigger} onClick={handleToggle} disabled={disabled}
              title={disabled ? 'Start the server first' : 'Start a new run'} aria-expanded={open}>
        ▶ New run
      </button>

      {open && (
        <form className={styles.panel} onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="run-goal">Goal</label>
          <textarea id="run-goal" className={styles.goal} rows={4} value={goal}
                    onChange={(e) => setGoal(e.target.value)} placeholder="What should the team do?" />

          <label className={styles.label} htmlFor="run-approvals">Ask me before</label>
          <select id="run-approvals" className={styles.select} value={mode}
                  onChange={(e) => setMode(e.target.value)}>
            {APPROVAL_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.start} disabled={starting || !goal.trim()}>
            {starting ? 'Starting…' : 'Start run'}
          </button>
        </form>
      )}
    </div>
  );
}
