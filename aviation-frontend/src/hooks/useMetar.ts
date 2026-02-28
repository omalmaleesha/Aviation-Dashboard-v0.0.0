import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchMetar } from '../store/slices/metarSlice';

const POLL_INTERVAL = 60_000; // refresh METAR every 60 seconds

/**
 * Polls METAR data and dispatches the async thunk into Redux.
 */
export function useMetar(icao: string) {
  const dispatch = useAppDispatch();
  const metar = useAppSelector((s) => s.metar.metar);
  const isLoading = useAppSelector((s) => s.metar.isLoading);
  const error = useAppSelector((s) => s.metar.error);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    dispatch(fetchMetar(icao));
    timerRef.current = setInterval(() => dispatch(fetchMetar(icao)), POLL_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [dispatch, icao]);

  return { metar, isLoading, error };
}
