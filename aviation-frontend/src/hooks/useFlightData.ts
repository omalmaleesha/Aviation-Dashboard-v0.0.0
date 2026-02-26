import { useEffect, useRef, useState, useCallback } from 'react';
import type { Flight, FlightWebSocketMessage, RawFlightData } from '../types/flight';
import { normalizeRawFlight } from '../types/flight';
import { MOCK_FLIGHTS } from '../data/mockFlights';
import { useInterval } from './useInterval';
import { WS_FLIGHTS_URL } from '../config';

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * How often the useRef buffer is flushed into React state.
 * Prevents re-render storms when the WS pushes data faster
 * than the UI can paint (especially with 1 000+ flights).
 */
const THROTTLE_MS = 2_000;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'using-mock';

export function useFlightData() {
  const [flights, setFlights] = useState<Flight[]>(MOCK_FLIGHTS);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

  /**
   * The WebSocket `onmessage` handler writes here *without* calling setState,
   * so even very frequent pushes (100 ms) add no extra renders.
   */
  const bufferRef = useRef<Flight[]>(MOCK_FLIGHTS);
  /** Whether the buffer has been written to since the last flush. */
  const dirtyRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // ── Flush buffer → state every THROTTLE_MS ──────────────────
  const flush = useCallback(() => {
    if (dirtyRef.current) {
      dirtyRef.current = false;
      setFlights(bufferRef.current);
    }
  }, []);

  useInterval(flush, THROTTLE_MS);

  // ── WebSocket lifecycle ─────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      setConnectionStatus('connecting');

      let ws: WebSocket;
      try {
        ws = new WebSocket(WS_FLIGHTS_URL);
      } catch {
        setConnectionStatus('using-mock');
        bufferRef.current = MOCK_FLIGHTS;
        dirtyRef.current = true;
        return;
      }

      wsRef.current = ws;

      ws.addEventListener('open', () => {
        if (!mountedRef.current) return;
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data as string);

          // Handle raw RawFlightData[] array (server pushes plain JSON array)
          if (Array.isArray(data)) {
            bufferRef.current = (data as RawFlightData[]).map(normalizeRawFlight);
            dirtyRef.current = true;
            return;
          }

          // Handle wrapped message format { type, flights, alert }
          const msg = data as FlightWebSocketMessage;
          if (msg.type === 'flights_update' && msg.flights) {
            bufferRef.current = msg.flights;
            dirtyRef.current = true;
          }
        } catch { /* skip malformed messages */ }
      });

      ws.addEventListener('close', () => {
        if (!mountedRef.current) return;
        wsRef.current = null;

        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current += 1;
          setConnectionStatus('disconnected');
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
        } else {
          setConnectionStatus('using-mock');
          bufferRef.current = MOCK_FLIGHTS;
          dirtyRef.current = true;
        }
      });

      ws.addEventListener('error', () => {
        if (reconnectAttempts.current === 0) {
          bufferRef.current = MOCK_FLIGHTS;
          dirtyRef.current = true;
        }
      });
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, []);

  return { flights, connectionStatus };
}
