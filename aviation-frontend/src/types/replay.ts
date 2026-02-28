import type { Flight, FlightStatus } from './flight';

// ── Replay Modes ────────────────────────────────────────────────
export type ReplayMode = 'LIVE' | 'REPLAY';

// ── Keyframe from GET /api/replay (no query param) ──────────────
export interface ReplayKeyframe {
  timestamp: string;
  flight_count: number;
}

export interface KeyframesResponse {
  buffer_window_minutes: number;
  total_keyframes: number;
  keyframes: ReplayKeyframe[];
}

// ── Raw flight shape returned by the snapshot endpoint ──────────
export interface ReplayRawFlight {
  id: string;
  lat: number;
  lng: number;
  heading: number;
  status: string; // e.g. "EN_ROUTE", "DESCENDING"
}

// ── Snapshot from GET /api/replay?timestamp=<ISO> ───────────────
export interface ReplaySnapshotResponse {
  timestamp: string;
  requested_timestamp: string;
  delta_seconds: number;
  flight_count: number;
  flights: ReplayRawFlight[];
}

// ── Replay State ────────────────────────────────────────────────
export interface ReplayState {
  /** Current mode — LIVE uses WebSocket, REPLAY uses historical API. */
  mode: ReplayMode;

  /** Slider offset in seconds from now. 0 = now, -1800 = 30 min ago. */
  offsetSeconds: number;

  /** Absolute ISO timestamp the slider currently represents. */
  replayTimestamp: string;

  /** Whether a replay fetch is currently in progress. */
  isFetching: boolean;

  /** Historical flight data returned from the replay API. */
  replayFlights: Flight[];

  /** Error message from the last replay fetch, if any. */
  error: string | null;

  /** Available keyframes fetched when entering REPLAY mode. */
  keyframes: ReplayKeyframe[];

  /** Number of flights at the current snapshot. */
  snapshotFlightCount: number;

  /** Delta between requested and actual snapshot timestamp. */
  snapshotDeltaSeconds: number;
}

// ── Replay Controller Props ─────────────────────────────────────
export interface ReplayControllerProps {
  mode: ReplayMode;
  offsetSeconds: number;
  replayTimestamp: string;
  isFetching: boolean;
  keyframes: ReplayKeyframe[];
  snapshotFlightCount: number;
  snapshotDeltaSeconds: number;
  onModeChange: (mode: ReplayMode) => void;
  onOffsetChange: (offsetSeconds: number) => void;
}

// ── Constants ───────────────────────────────────────────────────
/** Maximum replay window in seconds (30 minutes). */
export const REPLAY_WINDOW_SEC = 30 * 60; // 1800

/** Debounce delay in ms for the slider input. */
export const SLIDER_DEBOUNCE_MS = 350;

// ── Helpers ─────────────────────────────────────────────────────

/** Map API status strings (UPPER_SNAKE) → internal FlightStatus. */
const REPLAY_STATUS_MAP: Record<string, FlightStatus> = {
  'EN_ROUTE':   'EN ROUTE',
  'DESCENDING': 'DESCENDING',
  'CLIMBING':   'CLIMBING',
  'LANDED':     'LANDED',
  'DELAYED':    'DELAYED',
  'LANDING':    'LANDING',
};

/**
 * Normalize a replay flight (`{ id, lat, lng, heading, status }`)
 * into the full internal `Flight` type with sensible defaults for
 * fields not present in the replay snapshot.
 */
export function normalizeReplayFlight(raw: ReplayRawFlight): Flight {
  return {
    flightId:          raw.id,
    callsign:          raw.id,
    origin:            '—',
    destination:       '—',
    latitude:          raw.lat,
    longitude:         raw.lng,
    altitude:          0,
    speed:             0,
    heading:           raw.heading,
    progress:          0,
    status:            REPLAY_STATUS_MAP[raw.status] ?? 'EN ROUTE',
    distanceToAirport: null,
  };
}
