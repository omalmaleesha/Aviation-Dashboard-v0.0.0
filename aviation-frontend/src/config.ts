/**
 * Centralised runtime configuration.
 *
 * All values are read from Vite's `import.meta.env` (populated from `.env`).
 * A fallback is provided for local development so the app works without a
 * `.env` file, but production builds should always set the env vars.
 */

/** Base URL for the REST API (no trailing slash). */
export const API_BASE: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

/** WebSocket URL for live flight data. */
export const WS_FLIGHTS_URL: string =
  import.meta.env.VITE_WS_FLIGHTS_URL ?? 'ws://localhost:8000/ws/flights';

/** WebSocket URL for live alert data. */
export const WS_ALERTS_URL: string =
  import.meta.env.VITE_WS_ALERTS_URL ?? 'ws://localhost:8000/ws/alerts';

/** Default METAR station ICAO code. */
export const DEFAULT_METAR_ICAO: string =
  import.meta.env.VITE_DEFAULT_METAR_ICAO ?? 'VCBI';
