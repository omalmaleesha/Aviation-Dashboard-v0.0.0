import { useEffect, useRef, useMemo } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-rotatedmarker';
import type { Flight, RoutePoint } from '../types/flight';
import { useFlightRoute } from '../hooks/useFlightRoute';

// ── Plane SVG Icon ──────────────────────────────────────────────
function createPlaneIcon(status: string, isHistorical = false) {
  let color: string;
  if (isHistorical) {
    // Desaturated blue / greyscale palette for historical markers
    color = status === 'DELAYED' ? '#9ca3af' : status === 'LANDING' ? '#7c8db5' : '#6b85b3';
  } else {
    color = status === 'DELAYED' ? '#ef4444' : status === 'LANDING' ? '#a855f7' : '#3b82f6';
  }

  const opacity = isHistorical ? '0.7' : '1';

  return L.divIcon({
    html: `<svg viewBox="0 0 24 24" width="28" height="28" fill="${color}" fill-opacity="${opacity}" stroke="#0f172a" stroke-width="0.5" xmlns="http://www.w3.org/2000/svg"><path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
    className: isHistorical ? 'replay-marker' : '',
  });
}

// ── Smoothly-animated Rotated Marker ────────────────────────────
/**
 * Uses internal state to animate Leaflet marker position.
 * Uses a single rAF step (no continuous loop) to avoid
 * saturating the main thread with hundreds of concurrent animations.
 */
const ANIMATE_DURATION_MS = 800;
const MIN_MOVE_THRESHOLD = 0.0001; // ~11 meters — skip animation for tiny moves

function RotatedPlaneMarker({
  flight,
  isHistorical = false,
  onSelect,
}: {
  flight: Flight;
  isHistorical?: boolean;
  onSelect?: (flightId: string) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  const prevPos = useRef<[number, number]>([flight.latitude, flight.longitude]);
  const animFrameRef = useRef<number | null>(null);

  // Smooth position interpolation — only animate when movement is significant
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const startPos = prevPos.current;
    const endPos: [number, number] = [flight.latitude, flight.longitude];

    // Skip animation if the movement is negligible
    const dLat = Math.abs(endPos[0] - startPos[0]);
    const dLng = Math.abs(endPos[1] - startPos[1]);
    if (dLat < MIN_MOVE_THRESHOLD && dLng < MIN_MOVE_THRESHOLD) {
      marker.setLatLng(endPos);
      prevPos.current = endPos;
      return;
    }

    const startTime = performance.now();
    const m = marker; // capture for closure

    function animate(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / ANIMATE_DURATION_MS, 1);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      const lat = startPos[0] + (endPos[0] - startPos[0]) * ease;
      const lng = startPos[1] + (endPos[1] - startPos[1]) * ease;

      m.setLatLng([lat, lng]);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        prevPos.current = endPos;
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      prevPos.current = endPos;
    };
  }, [flight.latitude, flight.longitude]);

  // Heading rotation
  useEffect(() => {
    const marker = markerRef.current;
    if (marker) {
      marker.setRotationAngle(flight.heading);
      marker.setRotationOrigin('center center');
    }
  }, [flight.heading]);

  // Update icon when historical mode changes
  useEffect(() => {
    const marker = markerRef.current;
    if (marker) {
      marker.setIcon(createPlaneIcon(flight.status, isHistorical));
    }
  }, [flight.status, isHistorical]);

  return (
    <Marker
      ref={markerRef}
      position={[flight.latitude, flight.longitude]}
      icon={createPlaneIcon(flight.status, isHistorical)}
      eventHandlers={{
        click: () => onSelect?.(flight.flightId),
      }}
    >
      <Popup className="flight-popup" offset={[0, -14]}>
        <div style={{
          background: '#0f172a',
          color: '#e2e8f0',
          borderRadius: 8,
          padding: '12px 16px',
          minWidth: 200,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          border: '1px solid #1e293b',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#3b82f6' }}>{flight.flightId}</span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 9999,
              background: 'rgba(59,130,246,0.15)',
              color: '#60a5fa',
            }}>{flight.status}</span>
          </div>
          <div style={{ color: '#94a3b8', marginBottom: 8 }}>
            {formatAirportLabel(flight.origin, 'Unknown origin')} → {formatAirportLabel(flight.destination, 'Unknown destination')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>ALT</div>
              <div style={{ color: '#f8fafc', fontWeight: 600 }}>{flight.altitude.toLocaleString()} ft</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>SPD</div>
              <div style={{ color: '#f8fafc', fontWeight: 600 }}>{flight.speed} kts</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>HDG</div>
              <div style={{ color: '#f8fafc', fontWeight: 600 }}>{flight.heading}°</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>PROG</div>
              <div style={{ color: '#f8fafc', fontWeight: 600 }}>{flight.progress}%</div>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

// ── Invalidate map size on container resize ─────────────────────
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const timeout = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timeout);
  }, [map]);
  return null;
}

// ── Custom Cluster Icon Factory ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount() as number;
  let size: number;
  let className: string;

  if (count < 10) {
    size = 36;
    className = 'flight-cluster flight-cluster-sm';
  } else if (count < 50) {
    size = 44;
    className = 'flight-cluster flight-cluster-md';
  } else {
    size = 52;
    className = 'flight-cluster flight-cluster-lg';
  }

  return L.divIcon({
    html: `<div><span>${count}</span></div>`,
    className,
    iconSize: L.point(size, size),
  });
}

// ── Main Export ──────────────────────────────────────────────────
interface FlightMapProps {
  flights: Flight[];
  isHistorical?: boolean;
  focusFlightId?: string | null;
}

function formatAirportLabel(value?: string | null, fallback = 'Unknown airport'): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function pointToLatLng(point?: RoutePoint | null): [number, number] | null {
  if (!point) return null;
  return [point.lat, point.lng];
}

function FocusOnSelectedFlight({ selectedFlight }: { selectedFlight?: Flight }) {
  const map = useMap();
  const lastFocusedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedFlight) return;

    const normalizedId = selectedFlight.flightId.trim().toLowerCase();
    if (!normalizedId || lastFocusedIdRef.current === normalizedId) return;

    lastFocusedIdRef.current = normalizedId;
    const nextZoom = Math.max(map.getZoom(), 7);
    map.flyTo([selectedFlight.latitude, selectedFlight.longitude], nextZoom, {
      duration: 0.8,
      easeLinearity: 0.2,
    });
  }, [map, selectedFlight]);

  return null;
}

export function FlightMap({ flights, isHistorical = false, focusFlightId = null }: FlightMapProps) {
  const { selectedFlightId, route, isLoading, message, selectFlight, clearSelection } = useFlightRoute(2);

  // Memoize cluster options so the object reference stays stable across renders
  const clusterOptions = useMemo(() => ({
    chunkedLoading: true,
    maxClusterRadius: 60,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: 12,
    iconCreateFunction: createClusterIcon,
    animate: true,
    animateAddingMarkers: false,
    removeOutsideVisibleBounds: true,
  }), []);

  useEffect(() => {
    if (!selectedFlightId) return;

    const selectedStillVisible = flights.some(
      (f) => f.flightId.toLowerCase() === selectedFlightId.toLowerCase(),
    );

    if (!selectedStillVisible) {
      clearSelection();
    }
  }, [clearSelection, flights, selectedFlightId]);

  const effectiveSelectedFlightId = focusFlightId?.trim() || selectedFlightId;

  const selectedFlight = effectiveSelectedFlightId
    ? flights.find((f) => f.flightId.toLowerCase() === effectiveSelectedFlightId.toLowerCase())
    : undefined;

  const originLabel = formatAirportLabel(route?.origin_icao, formatAirportLabel(selectedFlight?.origin, 'Unknown origin'));
  const destinationLabel = formatAirportLabel(route?.destination_icao, formatAirportLabel(selectedFlight?.destination, 'Unknown destination'));

  const historicalRoute = route?.points?.map((p) => [p.lat, p.lng] as [number, number]) ?? [];
  const projectedRoute = route?.projected_points?.map((p) => [p.lat, p.lng] as [number, number]) ?? [];
  const fullRoute = route?.full_route_points?.map((p) => [p.lat, p.lng] as [number, number]) ?? [];

  const drawHistorical = historicalRoute.length >= 2;
  const drawProjected = projectedRoute.length >= 2;
  const drawFull = !drawHistorical && !drawProjected && fullRoute.length >= 2;

  const startLatLng = pointToLatLng(route?.start_point);
  const currentLatLng = pointToLatLng(route?.current_point);
  const endLatLng = pointToLatLng(route?.end_point);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[7.8731, 80.7718]}
        zoom={5}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        preferCanvas={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        <MapResizeHandler />
  <FocusOnSelectedFlight selectedFlight={selectedFlight} />

        {drawHistorical && (
          <Polyline
            positions={historicalRoute}
            pathOptions={{
              color: '#facc15',
              weight: 3,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {drawProjected && (
          <Polyline
            positions={projectedRoute}
            pathOptions={{
              color: '#38bdf8',
              weight: 3,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
              dashArray: '6 10',
            }}
          />
        )}

        {drawFull && (
          <Polyline
            positions={fullRoute}
            pathOptions={{
              color: '#facc15',
              weight: 3,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {startLatLng && (
          <CircleMarker
            center={startLatLng}
            radius={5}
            pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.95, weight: 1 }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>Start</Tooltip>
          </CircleMarker>
        )}

        {currentLatLng && (
          <CircleMarker
            center={currentLatLng}
            radius={6}
            pathOptions={{ color: '#facc15', fillColor: '#facc15', fillOpacity: 1, weight: 1 }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>Current</Tooltip>
          </CircleMarker>
        )}

        {endLatLng && (
          <CircleMarker
            center={endLatLng}
            radius={5}
            pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.95, weight: 1 }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>End</Tooltip>
          </CircleMarker>
        )}

        <MarkerClusterGroup {...clusterOptions}>
          {flights.map((flight) => (
            <RotatedPlaneMarker
              key={flight.flightId}
              flight={flight}
              isHistorical={isHistorical}
              onSelect={selectFlight}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {(selectedFlightId || isLoading || message) && (
        <div className="absolute top-3 left-3 z-[1000] rounded-lg border border-yellow-400/30 bg-slate-900/85 px-3 py-2 text-xs font-mono text-slate-100 backdrop-blur">
          <div className="font-semibold text-yellow-300">
            {selectedFlightId ? `Route: ${selectedFlightId}` : 'Route'}
          </div>
          {isLoading && <div className="text-slate-300">Loading route…</div>}
          {!isLoading && message && <div className="text-amber-300">{message}</div>}
          {!isLoading && !message && route && (
            <div className="text-slate-300 space-y-0.5">
              <div>
                {route.point_count} history points ({new Date(route.start_timestamp).toLocaleTimeString()} →{' '}
                {new Date(route.end_timestamp).toLocaleTimeString()})
              </div>
              <div>
                projected: {route.projected_points?.length ?? 0} • source: {route.route_source ?? 'HISTORY_ONLY'}
              </div>
              <div>
                {originLabel} → {destinationLabel}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
