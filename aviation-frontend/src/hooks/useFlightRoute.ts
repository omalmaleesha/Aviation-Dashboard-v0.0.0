import { useCallback, useRef, useState } from 'react';
import { API_BASE } from '../config';
import type { FlightRouteResponse } from '../types/flight';
import { authFetch } from '../auth/authFetch';

const DEFAULT_MIN_POINTS = 2;
const NOT_FOUND_COOLDOWN_MS = 30_000;

export function useFlightRoute(minPoints = DEFAULT_MIN_POINTS) {
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [route, setRoute] = useState<FlightRouteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const notFoundUntilRef = useRef<Map<string, number>>(new Map());

  const clearSelection = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSelectedFlightId(null);
    setRoute(null);
    setMessage(null);
    setIsLoading(false);
  }, []);

  const selectFlight = useCallback(
    async (flightId: string) => {
      const trimmedId = flightId.trim();
      if (!trimmedId) return;

      const now = Date.now();
      const cooldownUntil = notFoundUntilRef.current.get(trimmedId.toLowerCase()) ?? 0;
      if (cooldownUntil > now) {
        setSelectedFlightId(trimmedId);
        setRoute(null);
        setIsLoading(false);
        setMessage('Route not available yet for this flight.');
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSelectedFlightId(trimmedId);
      setIsLoading(true);
      setMessage(null);

      try {
        const url = `${API_BASE}/api/flights/${encodeURIComponent(trimmedId)}/route?min_points=${minPoints}`;
  const res = await authFetch(url, { signal: controller.signal });

        if (res.status === 404) {
          notFoundUntilRef.current.set(trimmedId.toLowerCase(), Date.now() + NOT_FOUND_COOLDOWN_MS);
          setRoute(null);
          setMessage('Route not available yet for this flight.');
          return;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data: FlightRouteResponse = await res.json();

        const historicalCount = data.points?.length ?? 0;
        const projectedCount = data.projected_points?.length ?? 0;
        const fullCount = data.full_route_points?.length ?? 0;
        const hasDrawableRoute =
          historicalCount >= minPoints ||
          projectedCount >= minPoints ||
          fullCount >= minPoints;

        if (!hasDrawableRoute) {
          notFoundUntilRef.current.set(trimmedId.toLowerCase(), Date.now() + NOT_FOUND_COOLDOWN_MS);
          setRoute(null);
          setMessage('Route not available yet for this flight.');
          return;
        }

        notFoundUntilRef.current.delete(trimmedId.toLowerCase());

        setRoute(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setRoute(null);
        setMessage(err instanceof Error ? `Failed to load route: ${err.message}` : 'Failed to load route');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [minPoints],
  );

  return {
    selectedFlightId,
    route,
    isLoading,
    message,
    selectFlight,
    clearSelection,
  };
}
