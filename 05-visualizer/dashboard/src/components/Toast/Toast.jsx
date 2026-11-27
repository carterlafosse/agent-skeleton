/*
 * Toast
 *
 * A pop-up card in the top right: the summary report is ready, the run was
 * stopped, or something failed. Optional action button, plus an X to dismiss.
 */

import styles from './Toast.module.css';

const ICONS = { success: '✓', error: '!', info: 'i' };

export default function Toast({ variant = 'success', title, message, actionLabel, onAction, onClose }) {
  // ---- Render ----
  return (
    <div className={`${styles.toast} ${styles[variant]}`} role={variant === 'error' ? 'alert' : 'status'}>
      <span className={styles.icon} aria-hidden="true">{ICONS[variant]}</span>
      <div className={styles.body}>
        <strong className={styles.title}>{title}</strong>
        <p className={styles.message}>{message}</p>
        {actionLabel && (
          <button type="button" className={styles.action} onClick={onAction}>{actionLabel}</button>
        )}
      </div>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Dismiss">×</button>
    </div>
  );
}
