import { useEffect, useRef, useState, useCallback } from 'react';
import type { Flight, RawFlightData } from '../types/flight';
import { normalizeRawFlight } from '../types/flight';
import { API_BASE } from '../config';
import { authFetch } from '../auth/authFetch';

const API_URL = `${API_BASE}/api/flights`;
const POLL_INTERVAL = 5000; // refresh every 5 seconds

export function useFlightAPI() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFlights = useCallback(async () => {
    try {
  const res = await authFetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // API may return a plain array or { flights: [...] }
      const rawArray: RawFlightData[] = Array.isArray(data)
        ? data
        : data.flights ?? [];

      if (mountedRef.current) {
        setFlights(rawArray.map(normalizeRawFlight));
        setError(null);
        setIsLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch flights');
        setIsLoading(false);
      }
    }
  }, []);

  const refetch = useCallback(() => {
    setIsLoading(true);
    fetchFlights();
  }, [fetchFlights]);

  useEffect(() => {
    mountedRef.current = true;
    fetchFlights();

    timerRef.current = setInterval(fetchFlights, POLL_INTERVAL);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchFlights]);

  return { flights, isLoading, error, refetch };
}
