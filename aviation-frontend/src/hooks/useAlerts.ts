import { useEffect, useRef, useState, useCallback } from 'react';
import type { AlertData } from '../types/flight';
import { API_BASE, WS_ALERTS_URL } from '../config';

const ALERTS_API = `${API_BASE}/api/alerts`;
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const MAX_ALERTS = 100; // keep last 100 in state

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [latestAlert, setLatestAlert] = useState<AlertData | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // ── Initial REST fetch ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(ALERTS_API);
        if (!res.ok) return;
        const data: AlertData[] = await res.json();
        if (!cancelled) {
          setAlerts(data.slice(0, MAX_ALERTS));
        }
      } catch {
        // silent — WS will be the primary source
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
          setLatestAlert(alert);
          setAlerts((prev) => [alert, ...prev].slice(0, MAX_ALERTS));
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
  }, []);

  /** Clear the latest alert (dismiss toast) */
  const dismissLatest = useCallback(() => setLatestAlert(null), []);

  return {
    alerts,
    alertCount: alerts.length,
    latestAlert,
    dismissLatest,
  };
}
