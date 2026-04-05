import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../config';
import { authFetch } from '../auth/authFetch';
import type { CommsOverviewResponse } from '../types/comms';

const POLL_MS = 10_000;
const COMMS_OVERVIEW_API = `${API_BASE}/api/comms/overview`;

const DEMO_FALLBACK: CommsOverviewResponse = {
  channels: [
    {
      channel_id: 'tower',
      label: 'Tower',
      frequency_mhz: 118.3,
      health: 'ONLINE',
      last_heartbeat_at: new Date().toISOString(),
      active_incidents: 0,
    },
    {
      channel_id: 'ground',
      label: 'Ground Ops',
      frequency_mhz: 121.9,
      health: 'DEGRADED',
      last_heartbeat_at: new Date(Date.now() - 90_000).toISOString(),
      active_incidents: 1,
    },
  ],
  messages: [
    {
      id: 'demo-1',
      channel_id: 'ground',
      source: 'Ramp Control',
      message: 'Stand B12 congestion expected for next 8 minutes.',
      priority: 'MEDIUM',
      created_at: new Date(Date.now() - 6 * 60_000).toISOString(),
      requires_ack: false,
      acknowledged: false,
    },
    {
      id: 'demo-2',
      channel_id: 'tower',
      source: 'ATC Tower',
      message: 'Windshear advisory runway 22. Coordinate sequencing updates.',
      priority: 'HIGH',
      created_at: new Date(Date.now() - 2 * 60_000).toISOString(),
      requires_ack: true,
      acknowledged: false,
    },
  ],
  unread_count: 2,
  active_incidents: 1,
};

export function useComms() {
  const [overview, setOverview] = useState<CommsOverviewResponse>(DEMO_FALLBACK);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await authFetch(COMMS_OVERVIEW_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CommsOverviewResponse;
      if (mountedRef.current) {
        setOverview(data);
        setError(null);
        setIsLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch comms data');
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchOverview();
    timerRef.current = setInterval(fetchOverview, POLL_MS);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchOverview]);

  return {
    overview,
    isLoading,
    error,
    refetch: fetchOverview,
  };
}
