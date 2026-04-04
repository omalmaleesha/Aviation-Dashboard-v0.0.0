export type FlightStatus = 'EN ROUTE' | 'DESCENDING' | 'CLIMBING' | 'LANDED' | 'DELAYED' | 'LANDING';

// ── Internal (normalized) flight type used by all components ────
export interface Flight {
  flightId: string;
  callsign: string;          // derived from flightId when API doesn't provide it
  origin: string;             // "—" when null from API
  destination: string;        // "—" when null from API
  latitude: number;
  longitude: number;
  altitude: number;           // feet
  speed: number;              // knots
  heading: number;            // degrees 0-360
  progress: number;           // 0-100
  status: FlightStatus;
  distanceToAirport: number | null;  // km — null when not provided

  // ── Financial & Sustainability fields (optional — derived when absent) ──
  aircraftType?: string;             // e.g. "B738", "A320"
  totalDistanceKm?: number;          // total route distance in km
  fuelBurnRateKgPerHr?: number;      // kg/hr fuel burn for this aircraft type
  fuelPricePerKg?: number;           // USD/kg of Jet-A fuel
  co2PerKgFuel?: number;             // kg CO2 per kg fuel burned (≈3.16)
  usesCDFA?: boolean;                // Continuous Descent Final Approach
}

// ── Raw shape coming from the backend REST / WebSocket ──────────
export interface RawFlightData {
  /** Backend may send `flightId` or `id` — normalizer handles both. */
  flightId?: string;
  id?: string;
  aircraft_type?: string | null;
  origin?: string | null;
  destination?: string | null;
  status: string;             // e.g. "EN_ROUTE", "DESCENDING"
  progress?: number;
  altitude?: number;
  speed?: number;
  lat: number;
  lng: number;
  heading: number;
  distance_to_airport?: number | null;
}

// ── METAR response from GET /api/metar/{icao} ───────────────────
export interface MetarResponse {
  icao: string;
  raw: string;
  decoded: string;
  timestamp: string;
}

// ── Alert from GET /api/alerts and ws alerts endpoint ───────
export type AlertSeverity = 'WARNING' | 'CRITICAL' | 'INFO';

export interface AlertData {
  id: string;
  flightId: string;
  distance_km: number;
  altitude: number;
  lat: number;
  lng: number;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
}

// ── Helpers ─────────────────────────────────────────────────────

/** Map API status strings (UPPER_SNAKE) to internal FlightStatus (spaces). */
const STATUS_MAP: Record<string, FlightStatus> = {
  'EN_ROUTE':   'EN ROUTE',
  'DESCENDING': 'DESCENDING',
  'CLIMBING':   'CLIMBING',
  'LANDED':     'LANDED',
  'DELAYED':    'DELAYED',
  'LANDING':    'LANDING',
};

function normalizeAirportLabel(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

function normalizeAircraftType(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Convert a raw API flight object into the normalised internal Flight type. */
export function normalizeRawFlight(raw: RawFlightData): Flight {
  const resolvedId = raw.flightId ?? raw.id ?? 'UNKNOWN';
  return {
    flightId:    resolvedId,
    callsign:    resolvedId,
    aircraftType: normalizeAircraftType(raw.aircraft_type),
    origin:      normalizeAirportLabel(raw.origin),
    destination: normalizeAirportLabel(raw.destination),
    latitude:    raw.lat,
    longitude:   raw.lng,
    altitude:    raw.altitude ?? 0,
    speed:       raw.speed ?? 0,
    heading:     raw.heading,
    progress:    raw.progress ?? 0,
    status:      STATUS_MAP[raw.status] ?? 'EN ROUTE',
    distanceToAirport: raw.distance_to_airport ?? null,
  };
}

export interface FlightWebSocketMessage {
  type: 'flights_update' | 'alert';
  flights?: Flight[];
  alert?: GeofenceAlert;
  timestamp: string;
}

export interface GeofenceAlert {
  flightId: string;
  zone: string;
  severity: 'warning' | 'critical';
  message: string;
}

export const STATUS_STYLES: Record<FlightStatus, { bg: string; text: string; border: string }> = {
  'EN ROUTE':    { bg: 'bg-blue-500/15',  text: 'text-blue-400',   border: 'border-blue-500/30' },
  'CLIMBING':    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'DESCENDING':  { bg: 'bg-amber-500/15', text: 'text-amber-400',  border: 'border-amber-500/30' },
  'LANDING':     { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  'LANDED':      { bg: 'bg-gray-500/15',  text: 'text-gray-400',   border: 'border-gray-500/30' },
  'DELAYED':     { bg: 'bg-red-500/15',   text: 'text-red-400',    border: 'border-red-500/30' },
};

// ── Fuel Analytics API (GET /api/analytics, GET /api/analytics/{flight_id}) ──
export interface FuelAnalyticsResponse {
  flight_id: string;
  aircraft_type: string;
  total_fuel_kg: number;
  total_cost_usd: number;
  total_co2_kg: number;
  current_altitude_ft: number;
  current_velocity_kts: number;
  updated_every_seconds: number;
}

// ── Summary endpoint: GET /api/analytics/summary ──────────────────
export interface FuelAnalyticsSummary {
  total_flights: number;
  total_fuel_kg: number;
  total_co2_kg: number;
  total_cost_usd: number;
  avg_fuel_per_flight_kg: number;
  avg_cost_per_flight_usd: number;
  updated_at: string;
}

// ── Paginated list: GET /api/analytics?limit=50&offset=0 ─────────
export interface PaginatedAnalyticsResponse {
  items: FuelAnalyticsResponse[];
  total: number;
  limit: number;
  offset: number;
}

// ── Flight Route endpoint: GET /api/flights/{flight_id}/route ───────────────
export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: string;
}

export type RouteSource = 'DESTINATION_AIRPORT' | 'HEADING_PROJECTION' | 'HISTORY_ONLY';

export interface FlightRouteResponse {
  flight_id: string;
  points: RoutePoint[];
  projected_points?: RoutePoint[];
  full_route_points?: RoutePoint[];
  start_point?: RoutePoint | null;
  current_point?: RoutePoint | null;
  end_point?: RoutePoint | null;
  origin_icao?: string | null;
  destination_icao?: string | null;
  route_source?: RouteSource;
  point_count: number;
  start_timestamp: string;
  end_timestamp: string;
  sampled_from_keyframes: number;
}

// ── Aircraft Type Details endpoints ─────────────────────────────────
export interface AircraftImageSet {
  exteriorImage: string;
  interiorImage: string;
  sideViewImage: string;
  cockpitImage: string;
}

export interface AircraftTypeDetail {
  typeId: string;
  modelName: string;
  manufacturer: string;
  category: string;
  length: number | string;
  wingspan: number | string;
  height: number | string;
  maxTakeoffWeight: number | string;
  passengerCapacity: number | string;
  crewCapacity: number | string;
  cargoCapacity: number | string;
  maxSpeed: number | string;
  cruiseSpeed: number | string;
  range: number | string;
  fuelCapacity: number | string;
  engineType: string;
  numberOfEngines: number | string;
  fuelType: string;
  maintenanceInterval: number | string;
  requiredRunwayLength: number | string;
  serviceCeiling: number | string;
  images: AircraftImageSet;
}
