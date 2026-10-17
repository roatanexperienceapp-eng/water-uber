import { useEffect, useState } from 'react';

/** The current time as state, refreshed every `everyMs`. Keeps render pure (no Date.now() in render). */
export function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
