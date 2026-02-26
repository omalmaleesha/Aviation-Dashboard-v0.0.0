import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  TurnaroundApiResponse,
  TurnaroundUpdateRequest,
  ApiTaskStatus,
} from '../types/turnaround';
import { API_BASE } from '../config';

const POLL_INTERVAL = 5_000;

/**
 * Low-level hook that talks to the turnaround backend endpoints:
 *   GET  /api/turnaround/{flight_id}
 *   POST /api/turnaround/{flight_id}/update
 *   GET  /api/turnarounds
 *
 * Returns raw API shapes; the higher-level `useTurnaround` hook maps
 * these to the UI-facing `TurnaroundState`.
 */
export function useTurnaroundAPI(flightId: string | null) {
  const [data, setData] = useState<TurnaroundApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch turnaround for a single flight ───────────────────────
  const fetchTurnaround = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/turnaround/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: TurnaroundApiResponse = await res.json();
      if (mountedRef.current) {
        setData(json);
        setError(null);
        setIsLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch turnaround');
        setIsLoading(false);
      }
    }
  }, []);

  // ── Poll when we have a flightId ──────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    if (!flightId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    fetchTurnaround(flightId);
    timerRef.current = setInterval(() => fetchTurnaround(flightId), POLL_INTERVAL);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [flightId, fetchTurnaround]);

  // ── Update a task status via POST ─────────────────────────────
  const updateTask = useCallback(
    async (taskName: string, status: ApiTaskStatus) => {
      if (!flightId) return;

      const body: TurnaroundUpdateRequest = { task_name: taskName, status };
      try {
        const res = await fetch(
          `${API_BASE}/api/turnaround/${encodeURIComponent(flightId)}/update`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: TurnaroundApiResponse = await res.json();
        if (mountedRef.current) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to update task');
        }
      }
    },
    [flightId],
  );

  // ── Fetch all turnarounds (utility) ───────────────────────────
  const fetchAll = useCallback(async (): Promise<TurnaroundApiResponse[]> => {
    try {
      const res = await fetch(`${API_BASE}/api/turnarounds`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as TurnaroundApiResponse[];
    } catch {
      return [];
    }
  }, []);

  return { data, isLoading, error, updateTask, fetchAll };
}
