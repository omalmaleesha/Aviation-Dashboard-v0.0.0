import { useEffect, useRef } from 'react';

/**
 * A declarative `setInterval` hook.
 *
 * - The callback is stored in a ref so changes don't restart the timer.
 * - Passing `null` as the delay pauses the interval.
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  // Keep the latest callback in the ref without restarting the interval.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
