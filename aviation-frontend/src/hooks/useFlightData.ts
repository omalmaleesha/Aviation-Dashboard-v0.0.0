import { useEffect, useRef, useCallback } from 'react';
import type { FlightWebSocketMessage, RawFlightData } from '../types/flight';
import { normalizeRawFlight } from '../types/flight';
import { MOCK_FLIGHTS } from '../data/mockFlights';
import { useInterval } from './useInterval';
import { WS_FLIGHTS_URL, API_BASE } from '../config';
import { useAppDispatch, useAppSelector } from '../store';
import {
  setFlights,
  setConnectionStatus,
  fallbackToMock,
} from '../store/slices/flightsSlice';

export type { ConnectionStatus } from '../store/slices/flightsSlice';

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const REST_FLIGHTS_URL = `${API_BASE}/api/flights`;
const REST_POLL_MS = 5_000;
const THROTTLE_MS = 1_000; // Flush flight buffer → Redux once per second (was 2s)

/**
 * Connects to the flight WebSocket / REST fallback and dispatches
 * updates into the Redux `flights` slice.
 *
 * Call this hook once at the top level — it only runs side-effects.
 * The return value is read from the Redux store.
 */
export function useFlightData() {
  const dispatch = useAppDispatch();
  const flights = useAppSelector((s) => s.flights.flights);
  const connectionStatus = useAppSelector((s) => s.flights.connectionStatus);

  const bufferRef = useRef(MOCK_FLIGHTS);
  const dirtyRef = useRef(false);
  const hasLiveDataRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ── Flush buffer → Redux every THROTTLE_MS ──────────────────
  const flush = useCallback(() => {
    if (dirtyRef.current) {
      dirtyRef.current = false;
      dispatch(setFlights(bufferRef.current));
    }
  }, [dispatch]);

  useInterval(flush, THROTTLE_MS);

  // ── REST fallback fetcher ───────────────────────────────────
  const fetchFlightsREST = useCallback(async () => {
    try {
      const res = await fetch(REST_FLIGHTS_URL);
      if (!res.ok) return;
      const data = await res.json();
      if (!mountedRef.current) return;

      const rawArray: RawFlightData[] = Array.isArray(data)
        ? data
        : data.flights ?? [];

      if (rawArray.length > 0) {
        bufferRef.current = rawArray.map(normalizeRawFlight);
        dirtyRef.current = true;
        hasLiveDataRef.current = true;
      }
    } catch {
      /* REST fetch failed silently — keep existing data */
    }
  }, []);

  const startRESTPolling = useCallback(() => {
    if (restTimerRef.current) return;
    fetchFlightsREST();
    restTimerRef.current = setInterval(fetchFlightsREST, REST_POLL_MS);
  }, [fetchFlightsREST]);

  const stopRESTPolling = useCallback(() => {
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }
  }, []);

  // ── WebSocket lifecycle ─────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      dispatch(setConnectionStatus('connecting'));

      let ws: WebSocket;
      try {
        ws = new WebSocket(WS_FLIGHTS_URL);
      } catch {
        dispatch(setConnectionStatus('disconnected'));
        startRESTPolling();
        return;
      }

      wsRef.current = ws;

      ws.addEventListener('open', () => {
        if (!mountedRef.current) return;
        dispatch(setConnectionStatus('connected'));
        reconnectAttempts.current = 0;
        stopRESTPolling();
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data as string);

          if (Array.isArray(data)) {
            const normalized = (data as RawFlightData[]).map(normalizeRawFlight);
            if (normalized.length > 0) {
              bufferRef.current = normalized;
              dirtyRef.current = true;
              hasLiveDataRef.current = true;
            }
            return;
          }

          const msg = data as FlightWebSocketMessage;
          if (msg.type === 'flights_update' && msg.flights) {
            bufferRef.current = msg.flights;
            dirtyRef.current = true;
            hasLiveDataRef.current = true;
          }
        } catch { /* skip malformed messages */ }
      });

      ws.addEventListener('close', () => {
        if (!mountedRef.current) return;
        wsRef.current = null;

        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current += 1;
          dispatch(setConnectionStatus('disconnected'));
          startRESTPolling();
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
        } else {
          if (!hasLiveDataRef.current) {
            dispatch(fallbackToMock());
          } else {
            dispatch(setConnectionStatus('disconnected'));
          }
        }
      });

      ws.addEventListener('error', () => {
        // `close` always follows `error` — reconnect handled there
      });
    }

    connect();

    return () => {
      mountedRef.current = false;
      stopRESTPolling();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [dispatch, startRESTPolling, stopRESTPolling]);

  return { flights, connectionStatus };
}
