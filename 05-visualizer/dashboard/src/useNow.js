/*
 * useNow
 *
 * Returns the current time (ms), refreshed every `interval` ms. Drives the
 * run timer and short-lived effects like the pulse when a tool is called.
 */

import { useEffect, useState } from 'react';

export default function useNow(interval = 250) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);

  return now;
}
