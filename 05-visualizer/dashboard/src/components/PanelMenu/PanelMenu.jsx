/*
 * PanelMenu
 *
 * The "Panels" dropdown in the top right. Lists the sidebar panels (live
 * events, lead summary); picking one opens it in the sidebar. A tick shows
 * which panels are already open. Closes when you click anywhere else.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './PanelMenu.module.css';

const OPTIONS = [
  { id: 'events', label: 'Live events' },
  { id: 'summary', label: 'Lead summary' },
];

export default function PanelMenu({ openTabs, onSelect }) {
  // ---- State ----
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // ---- Data ----
  // Close the menu on any click outside it.
  useEffect(() => {
    if (!open) return;
    function handleOutside(event) {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // ---- Handlers ----
  function handleSelect(id) {
    onSelect(id);
    setOpen(false);
  }

  // ---- Render ----
  return (
    <div className={styles.menu} ref={menuRef}>
      <button type="button" className={styles.trigger} onClick={() => setOpen(!open)}
              aria-expanded={open} aria-haspopup="menu">
        Panels <span className={styles.caret} aria-hidden="true">▾</span>
      </button>

      {open && (
        <ul className={styles.list} role="menu">
          {OPTIONS.map((option) => (
            <li key={option.id} role="none">
              <button type="button" role="menuitem" className={styles.item}
                      onClick={() => handleSelect(option.id)}>
                <span className={styles.check} aria-hidden="true">
                  {openTabs.includes(option.id) ? '✓' : ''}
                </span>
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
