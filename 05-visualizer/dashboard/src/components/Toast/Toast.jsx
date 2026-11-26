/*
 * Toast
 *
 * A pop-up card in the top right, used when the lead's summary report is
 * ready. Has an action button (open the report) and an X to dismiss it.
 */

import styles from './Toast.module.css';

export default function Toast({ title, message, actionLabel, onAction, onClose }) {
  // ---- Render ----
  return (
    <div className={styles.toast} role="status">
      <span className={styles.icon} aria-hidden="true">✓</span>
      <div className={styles.body}>
        <strong className={styles.title}>{title}</strong>
        <p className={styles.message}>{message}</p>
        <button type="button" className={styles.action} onClick={onAction}>{actionLabel}</button>
      </div>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Dismiss">×</button>
    </div>
  );
}
