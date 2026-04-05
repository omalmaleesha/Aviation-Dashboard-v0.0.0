import { useEffect, useRef, useCallback } from 'react';
import type { AlertData } from '../types/flight';
import { API_BASE, WS_ALERTS_URL } from '../config';
import { authFetch } from '../auth/authFetch';
import { useAppDispatch, useAppSelector } from '../store';
import { setAlerts, pushAlertsBatch, dismissLatestAlert } from '../store/slices/alertsSlice';
import { useInterval } from './useInterval';

const ALERTS_API = `${API_BASE}/api/alerts`;
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const MAX_ALERTS = 100;
const ALERT_FLUSH_MS = 2_000; // Flush buffered alerts every 2s (was 500ms — was causing 2 Redux updates/sec)

/**
 * Connects to the alerts REST + WebSocket endpoints and dispatches
 * updates into the Redux `alerts` slice.
 *
 * **Batched updates**: incoming WS alerts are buffered in memory and
 * flushed to Redux every ALERT_FLUSH_MS (500ms) — this collapses
 * hundreds of per-second dispatches into ~2 UI updates/sec.
 */
export function useAlerts() {
  const dispatch = useAppDispatch();
  const alerts = useAppSelector((s) => s.alerts.alerts);
  const latestAlert = useAppSelector((s) => s.alerts.latestAlert);

  // ── In-memory buffer for incoming WS alerts ─────────────────
  const alertBufferRef = useRef<AlertData[]>([]);
  const dirtyRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // ── Flush buffered alerts → Redux on a fixed interval ───────
  const flushAlerts = useCallback(() => {
    if (dirtyRef.current && alertBufferRef.current.length > 0) {
      dirtyRef.current = false;
      const batch = alertBufferRef.current;
      alertBufferRef.current = [];
      dispatch(pushAlertsBatch(batch));
    }
  }, [dispatch]);

  useInterval(flushAlerts, ALERT_FLUSH_MS);

  // ── Initial REST fetch ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
  const res = await authFetch(ALERTS_API);
        if (!res.ok) return;
        const data: AlertData[] = await res.json();
        if (!cancelled) {
          dispatch(setAlerts(data.slice(0, MAX_ALERTS)));
        }
      } catch {
        // silent — WS will be the primary source
      }
    })();
    return () => { cancelled = true; };
  }, [dispatch]);

  // ── WebSocket for real-time alerts ──────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      let ws: WebSocket;
      try {
        ws = new WebSocket(WS_ALERTS_URL);
      } catch {
        return;
      }

      wsRef.current = ws;

      ws.addEventListener('open', () => {
        reconnectAttempts.current = 0;
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const alert: AlertData = JSON.parse(event.data as string);
          // Buffer the alert — it will be flushed on the next interval tick
          alertBufferRef.current.push(alert);
          dirtyRef.current = true;
        } catch { /* skip malformed */ }
      });

      ws.addEventListener('close', () => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current += 1;
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
        }
      });

      ws.addEventListener('error', () => {
        // will trigger close → reconnect
      });
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [dispatch]);

  const dismissLatest = useCallback(() => dispatch(dismissLatestAlert()), [dispatch]);

  return {
    alerts,
    alertCount: alerts.length,
    latestAlert,
    dismissLatest,
  };
}
