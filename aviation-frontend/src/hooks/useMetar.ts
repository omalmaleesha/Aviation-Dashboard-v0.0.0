import { useEffect, useRef, useState, useCallback } from 'react';
import type { MetarResponse } from '../types/flight';
import { API_BASE as CONFIG_API_BASE } from '../config';

const API_BASE = `${CONFIG_API_BASE}/api/metar`;
const POLL_INTERVAL = 60_000; // refresh METAR every 60 seconds

export function useMetar(icao: string) {
  const [metar, setMetar] = useState<MetarResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetar = useCallback(async () => {
    if (!icao) return;
    try {
      const res = await fetch(`${API_BASE}/${icao}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MetarResponse = await res.json();
      if (mountedRef.current) {
        setMetar(data);
        setError(null);
        setIsLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch METAR');
        setIsLoading(false);
      }
    }
  }, [icao]);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    fetchMetar();

    timerRef.current = setInterval(fetchMetar, POLL_INTERVAL);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchMetar]);

  return { metar, isLoading, error };
}
