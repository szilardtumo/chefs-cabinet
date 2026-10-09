import { useEffect, useState } from 'react';

/** The current time in ms, updated every `intervalMs` while `enabled`, for live elapsed or relative times. */
export function useNow({ intervalMs = 1000, enabled = true }: { intervalMs?: number; enabled?: boolean } = {}) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs, enabled]);

  return now;
}
