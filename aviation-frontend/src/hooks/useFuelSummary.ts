import { useEffect, useRef, useState, useCallback } from 'react';
import type { FuelAnalyticsSummary } from '../types/flight';
import { API_BASE } from '../config';

const SUMMARY_POLL_MS = 60_000; // lightweight — every 60 s

/**
 * Polls GET /api/analytics/summary every 60 s.
 * Returns aggregate totals only (no per-flight data).
 */
export function useFuelSummary() {
  const [summary, setSummary] = useState<FuelAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/analytics/summary`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FuelAnalyticsSummary = await res.json();
      if (mountedRef.current) {
        setSummary(data);
        setError(null);
        setIsLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch summary');
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchSummary();
    timerRef.current = setInterval(fetchSummary, SUMMARY_POLL_MS);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchSummary]);

  return { summary, isLoading, error, refetch: fetchSummary };
}
