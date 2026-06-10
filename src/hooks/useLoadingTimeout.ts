import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_TIMEOUT_MS = 9000;

/**
 * Returns true after `timeoutMs` while `active` remains true.
 * Resets automatically when loading completes or when `reset()` is called.
 */
export function useLoadingTimeout(active: boolean, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const [timedOut, setTimedOut] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    if (!active) {
      generation.current++;
      setTimedOut(false);
      return;
    }

    const gen = ++generation.current;
    const timer = window.setTimeout(() => {
      if (gen === generation.current) {
        setTimedOut(true);
      }
    }, timeoutMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [active, timeoutMs]);

  const reset = useCallback(() => {
    generation.current++;
    setTimedOut(false);
  }, []);

  return { timedOut, reset };
}

export { DEFAULT_TIMEOUT_MS as LOADING_TIMEOUT_MS };
