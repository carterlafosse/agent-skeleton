/*
 * Sidebar
 *
 * The panel on the right. Drag its left edge to resize it. A row of tabs
 * across the top (each with an X to close it); the active tab's content
 * fills the rest. The parent hides the whole sidebar when every tab is closed.
 */

import styles from './Sidebar.module.css';

const MIN_WIDTH = 260;
const MAX_FRACTION = 0.6; // never wider than 60% of the window

export default function Sidebar({ tabs, activeTab, width, onResize, onSelect, onClose, children }) {
  // ---- Handlers ----
  // Drag the handle: the sidebar's width follows the pointer until released.
  function handleResizeStart(event) {
    event.preventDefault();
    document.body.style.cursor = 'col-resize';

    function handleMove(moveEvent) {
      const max = window.innerWidth * MAX_FRACTION;
      const next = window.innerWidth - moveEvent.clientX;
      onResize(Math.min(max, Math.max(MIN_WIDTH, next)));
    }

    function handleUp() {
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  // ---- Render ----
  return (
    <aside className={styles.sidebar} style={{ width }}>
      <div className={styles.handle} onPointerDown={handleResizeStart}
           role="separator" aria-orientation="vertical" aria-label="Resize sidebar" />

      <div className={styles.tabs} role="tablist">
        {tabs.map((tab) => (
          <div key={tab.id} className={`${styles.tab} ${tab.id === activeTab ? styles.active : ''}`}>
            <button type="button" role="tab" aria-selected={tab.id === activeTab}
                    className={styles.tabLabel} onClick={() => onSelect(tab.id)}>
              {tab.label}
            </button>
            <button type="button" className={styles.close} onClick={() => onClose(tab.id)}
                    aria-label={`Close ${tab.label}`}>
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Keyed by tab so switching tabs replays the fade-in. */}
      <div key={activeTab} className={styles.content}>
        {children}
      </div>
    </aside>
  );
}
